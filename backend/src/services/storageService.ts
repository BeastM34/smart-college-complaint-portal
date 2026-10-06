import path from 'path';
import crypto from 'crypto';
import { getSupabaseAdmin } from '../config/supabase';
import { AttachmentUploadResult } from '../types';

export const ATTACHMENTS_BUCKET = 'complaint-attachments';
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];
export const DEFAULT_SIGNED_URL_EXPIRY_SECONDS = 300; // 5 minutes

/**
 * Sanitizes a filename by stripping directory paths and non-alphanumeric characters.
 * Prevents directory traversal attacks (e.g. ../../etc/passwd).
 */
export const sanitizeFileName = (originalName: string): string => {
  const baseName = path.basename(originalName);
  const sanitized = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return sanitized.length > 0 ? sanitized : `file_${Date.now()}`;
};

/**
 * Ensures the private complaint-attachments bucket exists in Supabase Storage.
 * Configured with public: false, 5MB limit, and restricted MIME types.
 */
export const ensureBucketExists = async (): Promise<void> => {
  const supabase = getSupabaseAdmin();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  
  if (listError) {
    throw new Error(`Failed to list Supabase storage buckets: ${listError.message}`);
  }

  const existingBucket = buckets?.find((b) => b.name === ATTACHMENTS_BUCKET);
  if (!existingBucket) {
    const { error: createError } = await supabase.storage.createBucket(ATTACHMENTS_BUCKET, {
      public: false,
      fileSizeLimit: MAX_FILE_SIZE_BYTES,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    });

    if (createError && !createError.message.toLowerCase().includes('already exists')) {
      throw new Error(`Failed to create bucket "${ATTACHMENTS_BUCKET}": ${createError.message}`);
    }
  }
};

/**
 * Generates an isolated, non-colliding storage path for a complaint attachment.
 * Format: complaints/{complaintId}/{uniqueId}-{sanitizedFilename}
 */
export const buildStoragePath = (
  complaintId: string,
  originalName: string
): { storagePath: string; sanitizedName: string } => {
  const sanitizedName = sanitizeFileName(originalName);
  const uniqueId = crypto.randomUUID();
  const storagePath = `complaints/${complaintId}/${uniqueId}-${sanitizedName}`;
  return { storagePath, sanitizedName };
};

/**
 * Uploads a file buffer directly to Supabase Storage without writing to the local filesystem.
 */
export const uploadFileBuffer = async (
  complaintId: string,
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<AttachmentUploadResult> => {
  if (!buffer || buffer.length === 0) {
    throw new Error('File buffer is empty (0 bytes).');
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed size of 5 MB.`);
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`);
  }

  await ensureBucketExists();

  const { storagePath, sanitizedName } = buildStoragePath(complaintId, originalName);
  const supabase = getSupabaseAdmin();

  const { error: uploadError } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Supabase Storage upload failed: ${uploadError.message}`);
  }

  return {
    storagePath,
    fileName: sanitizedName,
    fileSize: buffer.length,
    mimeType,
  };
};

/**
 * Creates a short-lived signed download URL for private bucket objects.
 */
export const getSignedDownloadUrl = async (
  storagePath: string,
  expiresInSeconds: number = DEFAULT_SIGNED_URL_EXPIRY_SECONDS
): Promise<string> => {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed URL for "${storagePath}": ${error?.message || 'Unknown error'}`);
  }

  return data.signedUrl;
};

/**
 * Deletes an object from Supabase Storage by its storage path.
 * Used for cleanup, user deletions, and automatic transaction rollbacks.
 */
export const deleteStorageObject = async (storagePath: string): Promise<boolean> => {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .remove([storagePath]);

  if (error) {
    console.error(`[STORAGE ROLLBACK/DELETE ERROR] Failed to remove ${storagePath}:`, error.message);
    return false;
  }

  return true;
};
