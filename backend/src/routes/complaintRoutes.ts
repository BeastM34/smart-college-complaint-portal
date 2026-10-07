import { Router } from 'express';
import { ComplaintController } from '../controllers/complaintController';
import { AttachmentController } from '../controllers/attachmentController';
import { handleAttachmentUpload } from '../middleware/uploadMiddleware';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

// ==============================================================================
// Complaint CRUD Endpoints (Phase 4A)
// Base path: /api/complaints
// ==============================================================================

// Create a new complaint (Students / Admins)
router.post(
  '/',
  requireAuth,
  ComplaintController.createComplaint
);

// List complaints visible under RLS
router.get(
  '/',
  requireAuth,
  ComplaintController.listComplaints
);

// ==============================================================================
// Complaint Attachments Sub-Routes (Phase 2B)
// Base path: /api/complaints/:complaintId/attachments
// ==============================================================================

// Upload attachment for a complaint
router.post(
  '/:complaintId/attachments',
  handleAttachmentUpload,
  AttachmentController.uploadAttachment
);

// List all attachments for a complaint
router.get(
  '/:complaintId/attachments',
  AttachmentController.listAttachments
);

// Retrieve single attachment metadata & signed URL (or stream download)
router.get(
  '/:complaintId/attachments/:attachmentId',
  AttachmentController.getAttachment
);

// Delete attachment from Supabase Storage & database
router.delete(
  '/:complaintId/attachments/:attachmentId',
  AttachmentController.deleteAttachment
);

// ==============================================================================
// Complaint Workflow, Assignment, Status & Comments Endpoints (Phase 4B)
// ==============================================================================

// Assign or reassign complaint to staff (Admin only)
router.patch(
  '/:id/assignment',
  requireAuth,
  ComplaintController.assignComplaint
);

// Update complaint priority (Admin only)
router.patch(
  '/:id/priority',
  requireAuth,
  ComplaintController.updatePriority
);

// Update complaint workflow status (Staff / Admin)
router.patch(
  '/:id/status',
  requireAuth,
  ComplaintController.updateStatus
);

// Resolve complaint (Staff / Admin)
router.patch(
  '/:id/resolution',
  requireAuth,
  ComplaintController.resolveComplaint
);

// Reopen complaint (Student owner / Admin)
router.post(
  '/:id/reopen',
  requireAuth,
  ComplaintController.reopenComplaint
);

// Add public or internal comment (Student / Staff / Admin)
router.post(
  '/:id/comments',
  requireAuth,
  ComplaintController.addComment
);

// List comments for complaint visible under RLS
router.get(
  '/:id/comments',
  requireAuth,
  ComplaintController.getComments
);

// Get complaint audit timeline visible under RLS
router.get(
  '/:id/timeline',
  requireAuth,
  ComplaintController.getTimeline
);

// ==============================================================================
// Complaint Detail Lookups (Phase 4A)
// Declared after sub-resources to avoid parameter collision
// ==============================================================================

// Get complaint by human-readable ticket number (SCCP-YYYY-XXXXXX)
router.get(
  '/ticket/:ticketNumber',
  requireAuth,
  ComplaintController.getComplaintByTicketNumber
);

// Get complaint by UUID
router.get(
  '/:id',
  requireAuth,
  ComplaintController.getComplaintById
);

export default router;
