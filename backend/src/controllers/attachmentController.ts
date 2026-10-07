import { Request, Response } from 'express';
import { getSupabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import {
  uploadFileBuffer,
  getSignedDownloadUrl,
  deleteStorageObject,
  DEFAULT_SIGNED_URL_EXPIRY_SECONDS,
} from '../services/storageService';
import { ComplaintAttachment } from '../types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Controller for managing complaint attachments backed by Supabase Storage & PostgreSQL metadata.
 */
export class AttachmentController {
  /**
   * POST /api/complaints/:complaintId/attachments
   * Handles multipart file upload to Supabase Storage and records metadata in complaint_attachments.
   * Ensures failure rollback: if DB insert fails, the storage object is removed immediately.
   */
  public static async uploadAttachment(req: Request, res: Response): Promise<void> {
    const { complaintId } = req.params;

    if (!complaintId) {
      res.status(400).json({
        success: false,
        message: 'Complaint ID is required.',
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No file provided. Please attach a file under form field "file".',
      });
      return;
    }

    if (!req.file.buffer || req.file.buffer.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Uploaded file cannot be empty (0 bytes).',
      });
      return;
    }

    if (!isSupabaseConfigured()) {
      res.status(503).json({
        success: false,
        message: 'Supabase storage is not configured on this server.',
      });
      return;
    }

    const supabase = getSupabaseAdmin();

    // 1. Resolve Complaint & User Identity
    let resolvedComplaintId = complaintId;
    let resolvedUserId: string | null = ((req as any).user?.id || req.body?.uploaded_by || req.headers['x-user-id']) as string || null;

    if (UUID_REGEX.test(complaintId)) {
      const { data: complaint, error: cErr } = await supabase
        .from('complaints')
        .select('id, student_id')
        .eq('id', complaintId)
        .maybeSingle();

      if (cErr && cErr.code !== '42501') {
        res.status(500).json({
          success: false,
          message: `Database error verifying complaint: ${cErr.message}`,
        });
        return;
      }

      if (complaint) {
        resolvedComplaintId = complaint.id;
        if (!resolvedUserId) {
          resolvedUserId = complaint.student_id;
        }
      }
    } else {
      // Look up by ticket_number if alphanumeric string was passed
      const { data: complaintByTicket } = await supabase
        .from('complaints')
        .select('id, student_id')
        .eq('ticket_number', complaintId)
        .maybeSingle();

      if (complaintByTicket) {
        resolvedComplaintId = complaintByTicket.id;
        if (!resolvedUserId) {
          resolvedUserId = complaintByTicket.student_id;
        }
      }
    }

    // 2. Upload file directly to Supabase Storage (Memory -> Storage, zero local disk)
    let uploadResult;
    try {
      uploadResult = await uploadFileBuffer(
        resolvedComplaintId,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
    } catch (err: any) {
      res.status(400).json({
        success: false,
        message: err.message || 'Failed to upload file to storage.',
        error: err.name || 'STORAGE_UPLOAD_ERROR',
      });
      return;
    }

    // 3. Persist attachment metadata to complaint_attachments table
    // If resolvedUserId is still not available, we require it for foreign key integrity
    const userIdToInsert = resolvedUserId || (req.body?.uploaded_by as string);

    if (!userIdToInsert || !UUID_REGEX.test(userIdToInsert) || !UUID_REGEX.test(resolvedComplaintId)) {
      // If valid foreign keys cannot be linked yet (e.g. before auth/complaint is saved),
      // we still return the verified uploaded storage metadata and signed URL.
      const signedUrl = await getSignedDownloadUrl(uploadResult.storagePath, DEFAULT_SIGNED_URL_EXPIRY_SECONDS);
      res.status(201).json({
        success: true,
        message: 'Attachment uploaded to storage successfully (metadata unattached).',
        data: {
          file_name: uploadResult.fileName,
          storage_path: uploadResult.storagePath,
          mime_type: uploadResult.mimeType,
          file_size: uploadResult.fileSize,
          signed_url: signedUrl,
        },
      });
      return;
    }

    const { data: record, error: dbError } = await supabase
      .from('complaint_attachments')
      .insert({
        complaint_id: resolvedComplaintId,
        file_name: uploadResult.fileName,
        storage_path: uploadResult.storagePath,
        mime_type: uploadResult.mimeType,
        file_size: uploadResult.fileSize,
        uploaded_by: userIdToInsert,
      })
      .select()
      .single();

    // 4. Rollback Guarantee: Remove orphaned storage file if database persistence fails
    if (dbError) {
      console.warn(`[UPLOAD ROLLBACK] Database insert failed for ${uploadResult.storagePath}. Rolling back storage file...`);
      await deleteStorageObject(uploadResult.storagePath);

      res.status(500).json({
        success: false,
        message: `Database failed to register attachment: ${dbError.message}. Upload was rolled back safely.`,
        error: dbError.message,
      });
      return;
    }

    // 5. Generate short-lived signed URL for immediate viewing/previewing
    const signedUrl = await getSignedDownloadUrl(uploadResult.storagePath, DEFAULT_SIGNED_URL_EXPIRY_SECONDS);

    res.status(201).json({
      success: true,
      message: 'Attachment uploaded and registered successfully.',
      data: {
        ...(record as ComplaintAttachment),
        signed_url: signedUrl,
      },
    });
  }

  /**
   * GET /api/complaints/:complaintId/attachments
   * Lists all attachments registered for a complaint with temporary signed URLs.
   */
  public static async listAttachments(req: Request, res: Response): Promise<void> {
    const { complaintId } = req.params;

    if (!complaintId) {
      res.status(400).json({
        success: false,
        message: 'Complaint ID is required.',
      });
      return;
    }

    if (!isSupabaseConfigured()) {
      res.status(503).json({
        success: false,
        message: 'Supabase storage is not configured on this server.',
      });
      return;
    }

    const supabase = getSupabaseAdmin();

    let resolvedComplaintId = complaintId;
    if (!UUID_REGEX.test(complaintId)) {
      const { data: complaint } = await supabase
        .from('complaints')
        .select('id')
        .eq('ticket_number', complaintId)
        .maybeSingle();

      if (complaint) {
        resolvedComplaintId = complaint.id;
      }
    }

    const { data: records, error } = await supabase
      .from('complaint_attachments')
      .select('*')
      .eq('complaint_id', resolvedComplaintId)
      .order('created_at', { ascending: true });

    if (error) {
      res.status(500).json({
        success: false,
        message: `Failed to retrieve attachments: ${error.message}`,
        error: error.message,
      });
      return;
    }

    // Enrich each record with a signed URL for display/download
    const enriched = await Promise.all(
      (records || []).map(async (att) => {
        try {
          const signedUrl = await getSignedDownloadUrl(att.storage_path, DEFAULT_SIGNED_URL_EXPIRY_SECONDS);
          return { ...att, signed_url: signedUrl };
        } catch {
          return { ...att, signed_url: null };
        }
      })
    );

    res.status(200).json({
      success: true,
      message: 'Attachments retrieved successfully.',
      data: enriched,
    });
  }

  /**
   * GET /api/complaints/:complaintId/attachments/:attachmentId
   * Retrieves single attachment metadata with a fresh signed URL, or redirects if ?download=true.
   */
  public static async getAttachment(req: Request, res: Response): Promise<void> {
    const { complaintId, attachmentId } = req.params;
    const download = req.query.download === 'true';

    if (!attachmentId || !UUID_REGEX.test(attachmentId)) {
      res.status(404).json({
        success: false,
        message: `Attachment with ID "${attachmentId}" was not found.`,
      });
      return;
    }

    if (!isSupabaseConfigured()) {
      res.status(503).json({
        success: false,
        message: 'Supabase storage is not configured on this server.',
      });
      return;
    }

    const supabase = getSupabaseAdmin();

    const { data: attachment, error } = await supabase
      .from('complaint_attachments')
      .select('*')
      .eq('id', attachmentId)
      .maybeSingle();

    if (error || !attachment) {
      res.status(404).json({
        success: false,
        message: `Attachment with ID "${attachmentId}" was not found.`,
      });
      return;
    }

    try {
      const signedUrl = await getSignedDownloadUrl(attachment.storage_path, DEFAULT_SIGNED_URL_EXPIRY_SECONDS);

      if (download) {
        res.redirect(signedUrl);
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          ...attachment,
          signed_url: signedUrl,
        },
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to generate download URL for the requested attachment.',
      });
    }
  }

  /**
   * DELETE /api/complaints/:complaintId/attachments/:attachmentId
   * Deletes attachment object from Supabase Storage and deletes database metadata row.
   */
  public static async deleteAttachment(req: Request, res: Response): Promise<void> {
    const { attachmentId } = req.params;

    if (!attachmentId || !UUID_REGEX.test(attachmentId)) {
      res.status(404).json({
        success: false,
        message: `Attachment with ID "${attachmentId}" was not found.`,
      });
      return;
    }

    if (!isSupabaseConfigured()) {
      res.status(503).json({
        success: false,
        message: 'Supabase storage is not configured on this server.',
      });
      return;
    }

    const supabase = getSupabaseAdmin();

    const { data: attachment, error: fetchErr } = await supabase
      .from('complaint_attachments')
      .select('*')
      .eq('id', attachmentId)
      .maybeSingle();

    if (fetchErr || !attachment) {
      res.status(404).json({
        success: false,
        message: `Attachment with ID "${attachmentId}" was not found.`,
      });
      return;
    }

    // 1. Delete object from Supabase Storage
    await deleteStorageObject(attachment.storage_path);

    // 2. Delete metadata row from PostgreSQL table
    const { error: deleteErr } = await supabase
      .from('complaint_attachments')
      .delete()
      .eq('id', attachmentId);

    if (deleteErr) {
      res.status(500).json({
        success: false,
        message: 'File removed from storage, but database record update encountered an issue.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Attachment removed successfully from storage and database.',
    });
  }
}
