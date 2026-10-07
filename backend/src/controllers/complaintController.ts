import { Request, Response } from 'express';
import { ComplaintService } from '../services/complaintService';
import { ComplaintPriority } from '../types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ComplaintController {
  /**
   * POST /api/complaints
   * Creates a new complaint for an authenticated student.
   * Enforces server-side ticket generation, initial pending status, and author ownership.
   */
  public static async createComplaint(req: Request, res: Response): Promise<void> {
    if (!req.user || !req.user.id) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Missing user identity.',
      });
      return;
    }

    if (!req.supabase) {
      res.status(500).json({
        success: false,
        message: 'Internal server error: User database session is not available.',
      });
      return;
    }

    // Role check: Staff cannot submit complaints (only students and admins can)
    if (req.profile?.role === 'staff') {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Staff members are not authorized to submit complaints.',
      });
      return;
    }

    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({
        success: false,
        message: 'Request body must be a valid JSON object.',
      });
      return;
    }

    const {
      title,
      description,
      category,
      priority,
      department,
      building,
      floor,
      roomNumber,
      room_number,
      location,
      additionalDetails,
      additional_details,
    } = req.body;

    // Validate title
    if (title === undefined || title === null) {
      res.status(400).json({
        success: false,
        message: 'Title is required.',
      });
      return;
    }
    if (typeof title !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Title must be a string.',
      });
      return;
    }
    const cleanTitle = title.trim();
    if (cleanTitle.length < 3) {
      res.status(400).json({
        success: false,
        message: 'Title must be at least 3 characters long.',
      });
      return;
    }
    if (cleanTitle.length > 200) {
      res.status(400).json({
        success: false,
        message: 'Title cannot exceed 200 characters.',
      });
      return;
    }

    // Validate description
    if (description === undefined || description === null) {
      res.status(400).json({
        success: false,
        message: 'Description is required.',
      });
      return;
    }
    if (typeof description !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Description must be a string.',
      });
      return;
    }
    const cleanDesc = description.trim();
    if (cleanDesc.length < 5) {
      res.status(400).json({
        success: false,
        message: 'Description must be at least 5 characters long.',
      });
      return;
    }
    if (cleanDesc.length > 5000) {
      res.status(400).json({
        success: false,
        message: 'Description cannot exceed 5000 characters.',
      });
      return;
    }

    // Validate category
    if (category === undefined || category === null) {
      res.status(400).json({
        success: false,
        message: 'Category is required.',
      });
      return;
    }
    if (typeof category !== 'string' || !category.trim()) {
      res.status(400).json({
        success: false,
        message: 'Category must be a non-empty string.',
      });
      return;
    }
    if (category.trim().length > 100) {
      res.status(400).json({
        success: false,
        message: 'Category identifier cannot exceed 100 characters.',
      });
      return;
    }

    // Validate priority if provided
    let cleanPriority: ComplaintPriority = 'medium';
    if (priority !== undefined && priority !== null) {
      if (typeof priority !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Priority must be a valid string if provided.',
        });
        return;
      }
      const lowerPriority = priority.trim().toLowerCase();
      if (!['low', 'medium', 'high', 'critical'].includes(lowerPriority)) {
        res.status(400).json({
          success: false,
          message: 'Invalid priority. Allowed values are: low, medium, high, critical.',
        });
        return;
      }
      cleanPriority = lowerPriority as ComplaintPriority;
    }

    // Validate optional text fields
    if (department !== undefined && department !== null) {
      if (typeof department !== 'string' || department.length > 100) {
        res.status(400).json({
          success: false,
          message: 'Department must be a string not exceeding 100 characters.',
        });
        return;
      }
    }

    if (building !== undefined && building !== null) {
      if (typeof building !== 'string' || building.length > 100) {
        res.status(400).json({
          success: false,
          message: 'Building must be a string not exceeding 100 characters.',
        });
        return;
      }
    }

    if (floor !== undefined && floor !== null) {
      if (typeof floor !== 'string' || floor.length > 50) {
        res.status(400).json({
          success: false,
          message: 'Floor must be a string not exceeding 50 characters.',
        });
        return;
      }
    }

    const roomVal = roomNumber || room_number;
    if (roomVal !== undefined && roomVal !== null) {
      if (typeof roomVal !== 'string' || roomVal.length > 50) {
        res.status(400).json({
          success: false,
          message: 'Room number must be a string not exceeding 50 characters.',
        });
        return;
      }
    }

    if (location !== undefined && location !== null) {
      if (typeof location !== 'string' || location.length > 500) {
        res.status(400).json({
          success: false,
          message: 'Location must be a string not exceeding 500 characters.',
        });
        return;
      }
    }

    const detailsVal = additionalDetails || additional_details;
    if (detailsVal !== undefined && detailsVal !== null) {
      if (typeof detailsVal !== 'string' || detailsVal.length > 2000) {
        res.status(400).json({
          success: false,
          message: 'Additional details must be a string not exceeding 2000 characters.',
        });
        return;
      }
    }

    try {
      const created = await ComplaintService.createComplaint(
        req.supabase,
        req.user.id,
        {
          title: cleanTitle,
          description: cleanDesc,
          category: category.trim(),
          priority: cleanPriority,
          department,
          building,
          floor,
          roomNumber: roomVal,
          location,
          additionalDetails: detailsVal,
        }
      );

      res.status(201).json({
        success: true,
        message: 'Complaint submitted successfully.',
        data: created,
      });
    } catch (err: any) {
      const statusCode = err.statusCode || (err.code === '42501' ? 403 : 500);
      res.status(statusCode).json({
        success: false,
        message: err.message || 'Failed to submit complaint.',
      });
    }
  }

  /**
   * GET /api/complaints
   * Lists complaints visible to the authenticated user under Row Level Security.
   */
  public static async listComplaints(req: Request, res: Response): Promise<void> {
    if (!req.supabase) {
      res.status(500).json({
        success: false,
        message: 'Internal server error: User database session is not available.',
      });
      return;
    }

    const { status, priority, category, page, limit } = req.query;

    try {
      const result = await ComplaintService.listComplaints(req.supabase, {
        status: typeof status === 'string' ? status : undefined,
        priority: typeof priority === 'string' ? priority : undefined,
        category: typeof category === 'string' ? category : undefined,
        page: typeof page === 'string' || typeof page === 'number' ? page : undefined,
        limit: typeof limit === 'string' || typeof limit === 'number' ? limit : undefined,
      });

      res.status(200).json({
        success: true,
        data: result.complaints,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: err.message || 'Failed to retrieve complaints.',
      });
    }
  }

  /**
   * GET /api/complaints/:id
   * Retrieves a single complaint by UUID under RLS.
   * Returns 404 if the complaint does not exist or is not visible to caller (no info leakage).
   */
  public static async getComplaintById(req: Request, res: Response): Promise<void> {
    if (!req.supabase) {
      res.status(500).json({
        success: false,
        message: 'Internal server error: User database session is not available.',
      });
      return;
    }

    const { id } = req.params;

    if (!id || !UUID_REGEX.test(id)) {
      res.status(404).json({
        success: false,
        message: 'Complaint not found.',
      });
      return;
    }

    try {
      const complaint = await ComplaintService.getComplaintById(req.supabase, id);

      if (!complaint) {
        res.status(404).json({
          success: false,
          message: 'Complaint not found.',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: complaint,
      });
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: err.message || 'Failed to retrieve complaint.',
      });
    }
  }

  /**
   * GET /api/complaints/ticket/:ticketNumber
   * Retrieves a single complaint by Ticket Number under RLS.
   * Returns 404 if the complaint does not exist or is not visible to caller.
   */
  public static async getComplaintByTicketNumber(req: Request, res: Response): Promise<void> {
    if (!req.supabase) {
      res.status(500).json({
        success: false,
        message: 'Internal server error: User database session is not available.',
      });
      return;
    }

    const { ticketNumber } = req.params;

    if (!ticketNumber || typeof ticketNumber !== 'string' || !ticketNumber.trim()) {
      res.status(404).json({
        success: false,
        message: 'Complaint not found.',
      });
      return;
    }

    try {
      const complaint = await ComplaintService.getComplaintByTicketNumber(
        req.supabase,
        ticketNumber.trim()
      );

      if (!complaint) {
        res.status(404).json({
          success: false,
          message: 'Complaint not found.',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: complaint,
      });
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: err.message || 'Failed to retrieve complaint.',
      });
    }
  }

  /**
   * PATCH /api/complaints/:id/assignment
   * Assigns or reassigns a complaint to a staff member (Admin only).
   */
  public static async assignComplaint(req: Request, res: Response): Promise<void> {
    if (!req.user || !req.user.id) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Missing user identity.',
      });
      return;
    }

    if (!req.supabase) {
      res.status(500).json({
        success: false,
        message: 'Internal server error: User database session is not available.',
      });
      return;
    }

    if (req.profile?.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Only administrators can assign complaints.',
      });
      return;
    }

    const { id } = req.params;
    if (!id || !UUID_REGEX.test(id)) {
      res.status(404).json({
        success: false,
        message: 'Complaint not found.',
      });
      return;
    }

    const { assigned_to, assigned_department, notes } = req.body || {};
    if (!assigned_to || typeof assigned_to !== 'string' || !UUID_REGEX.test(assigned_to.trim())) {
      res.status(400).json({
        success: false,
        message: 'A valid staff user ID (UUID) is required.',
      });
      return;
    }

    try {
      const updated = await ComplaintService.assignComplaint(
        req.supabase,
        id,
        {
          assigned_to: assigned_to.trim(),
          assigned_department: typeof assigned_department === 'string' ? assigned_department.trim() : undefined,
          notes: typeof notes === 'string' ? notes.trim() : undefined,
        },
        { id: req.user.id, role: req.profile.role }
      );

      res.status(200).json({
        success: true,
        message: 'Complaint assigned successfully.',
        data: updated,
      });
    } catch (err: any) {
      const statusCode = err.statusCode || (err.code === '42501' ? 403 : 500);
      res.status(statusCode).json({
        success: false,
        message: err.message || 'Failed to assign complaint.',
      });
    }
  }

  /**
   * PATCH /api/complaints/:id/priority
   * Updates complaint priority (Admin only).
   */
  public static async updatePriority(req: Request, res: Response): Promise<void> {
    if (!req.user || !req.user.id) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Missing user identity.',
      });
      return;
    }

    if (!req.supabase) {
      res.status(500).json({
        success: false,
        message: 'Internal server error: User database session is not available.',
      });
      return;
    }

    if (req.profile?.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Only administrators can update complaint priority.',
      });
      return;
    }

    const { id } = req.params;
    if (!id || !UUID_REGEX.test(id)) {
      res.status(404).json({
        success: false,
        message: 'Complaint not found.',
      });
      return;
    }

    const { priority } = req.body || {};
    if (!priority || typeof priority !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Priority is required and must be a valid string.',
      });
      return;
    }

    const cleanPriority = priority.trim().toLowerCase() as any;
    if (!['low', 'medium', 'high', 'critical'].includes(cleanPriority)) {
      res.status(400).json({
        success: false,
        message: 'Priority must be one of: low, medium, high, critical.',
      });
      return;
    }

    try {
      const updated = await ComplaintService.updatePriority(
        req.supabase,
        id,
        cleanPriority,
        { id: req.user.id, role: req.profile.role }
      );

      res.status(200).json({
        success: true,
        message: 'Complaint priority updated successfully.',
        data: updated,
      });
    } catch (err: any) {
      const statusCode = err.statusCode || (err.code === '42501' ? 403 : 500);
      res.status(statusCode).json({
        success: false,
        message: err.message || 'Failed to update complaint priority.',
      });
    }
  }

  /**
   * PATCH /api/complaints/:id/status
   * Updates complaint workflow status according to state machine transitions (Staff or Admin).
   */
  public static async updateStatus(req: Request, res: Response): Promise<void> {
    if (!req.user || !req.user.id) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Missing user identity.',
      });
      return;
    }

    if (!req.supabase) {
      res.status(500).json({
        success: false,
        message: 'Internal server error: User database session is not available.',
      });
      return;
    }

    if (req.profile?.role === 'student') {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Students are not authorized to update complaint status directly.',
      });
      return;
    }

    const { id } = req.params;
    if (!id || !UUID_REGEX.test(id)) {
      res.status(404).json({
        success: false,
        message: 'Complaint not found.',
      });
      return;
    }

    const { status, notes, resolution_notes, estimated_resolution_date } = req.body || {};
    if (!status || typeof status !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Status is required.',
      });
      return;
    }

    try {
      const updated = await ComplaintService.updateComplaintStatus(
        req.supabase,
        id,
        {
          status: status.trim() as any,
          notes: typeof notes === 'string' ? notes : undefined,
          resolution_notes: typeof resolution_notes === 'string' ? resolution_notes : undefined,
          estimated_resolution_date: typeof estimated_resolution_date === 'string' ? estimated_resolution_date : undefined,
        },
        { id: req.user.id, role: req.profile?.role || 'staff' }
      );

      res.status(200).json({
        success: true,
        message: 'Complaint status updated successfully.',
        data: updated,
      });
    } catch (err: any) {
      const statusCode = err.statusCode || (err.code === '42501' ? 403 : 500);
      res.status(statusCode).json({
        success: false,
        message: err.message || 'Failed to update complaint status.',
      });
    }
  }

  /**
   * PATCH /api/complaints/:id/resolution
   * Marks complaint as resolved and records resolution notes (Staff or Admin).
   */
  public static async resolveComplaint(req: Request, res: Response): Promise<void> {
    if (!req.user || !req.user.id) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Missing user identity.',
      });
      return;
    }

    if (!req.supabase) {
      res.status(500).json({
        success: false,
        message: 'Internal server error: User database session is not available.',
      });
      return;
    }

    if (req.profile?.role === 'student') {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Students are not authorized to resolve complaints.',
      });
      return;
    }

    const { id } = req.params;
    if (!id || !UUID_REGEX.test(id)) {
      res.status(404).json({
        success: false,
        message: 'Complaint not found.',
      });
      return;
    }

    const { notes, resolution_notes } = req.body || {};

    try {
      const updated = await ComplaintService.updateComplaintStatus(
        req.supabase,
        id,
        {
          status: 'resolved',
          notes,
          resolution_notes,
        },
        { id: req.user.id, role: req.profile?.role || 'staff' }
      );

      res.status(200).json({
        success: true,
        message: 'Complaint marked as resolved successfully.',
        data: updated,
      });
    } catch (err: any) {
      const statusCode = err.statusCode || (err.code === '42501' ? 403 : 500);
      res.status(statusCode).json({
        success: false,
        message: err.message || 'Failed to resolve complaint.',
      });
    }
  }

  /**
   * POST /api/complaints/:id/reopen
   * Reopens a resolved or rejected complaint back to 'pending' (Student owner or Admin).
   */
  public static async reopenComplaint(req: Request, res: Response): Promise<void> {
    if (!req.user || !req.user.id) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Missing user identity.',
      });
      return;
    }

    if (!req.supabase) {
      res.status(500).json({
        success: false,
        message: 'Internal server error: User database session is not available.',
      });
      return;
    }

    if (req.profile?.role === 'staff') {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Staff members cannot reopen complaints.',
      });
      return;
    }

    const { id } = req.params;
    if (!id || !UUID_REGEX.test(id)) {
      res.status(404).json({
        success: false,
        message: 'Complaint not found.',
      });
      return;
    }

    const { reason } = req.body || {};
    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      res.status(400).json({
        success: false,
        message: 'A valid reopen reason (at least 5 characters) is required.',
      });
      return;
    }

    try {
      const updated = await ComplaintService.reopenComplaint(
        req.supabase,
        id,
        { reason: reason.trim() },
        { id: req.user.id, role: req.profile?.role || 'student' }
      );

      res.status(200).json({
        success: true,
        message: 'Complaint reopened successfully.',
        data: updated,
      });
    } catch (err: any) {
      const statusCode = err.statusCode || (err.code === '42501' ? 403 : 500);
      res.status(statusCode).json({
        success: false,
        message: err.message || 'Failed to reopen complaint.',
      });
    }
  }

  /**
   * POST /api/complaints/:id/comments
   * Adds a comment to a complaint.
   * Internal comments (is_internal: true) are strictly restricted to administrators.
   */
  public static async addComment(req: Request, res: Response): Promise<void> {
    if (!req.user || !req.user.id) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Missing user identity.',
      });
      return;
    }

    if (!req.supabase) {
      res.status(500).json({
        success: false,
        message: 'Internal server error: User database session is not available.',
      });
      return;
    }

    const { id } = req.params;
    if (!id || !UUID_REGEX.test(id)) {
      res.status(404).json({
        success: false,
        message: 'Complaint not found.',
      });
      return;
    }

    const { message, is_internal } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({
        success: false,
        message: 'Comment message is required.',
      });
      return;
    }

    if (message.trim().length > 2000) {
      res.status(400).json({
        success: false,
        message: 'Comment message cannot exceed 2000 characters.',
      });
      return;
    }

    if (is_internal === true && req.profile?.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Only administrators can create internal comments.',
      });
      return;
    }

    try {
      const comment = await ComplaintService.addComment(
        req.supabase,
        id,
        {
          message: message.trim(),
          is_internal: Boolean(is_internal),
        },
        { id: req.user.id, role: req.profile?.role || 'student' }
      );

      res.status(201).json({
        success: true,
        message: 'Comment added successfully.',
        data: comment,
      });
    } catch (err: any) {
      const statusCode = err.statusCode || (err.code === '42501' ? 403 : 500);
      res.status(statusCode).json({
        success: false,
        message: err.message || 'Failed to add comment.',
      });
    }
  }

  /**
   * GET /api/complaints/:id/comments
   * Retrieves comments for a complaint visible under Row Level Security.
   */
  public static async getComments(req: Request, res: Response): Promise<void> {
    if (!req.user || !req.user.id) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Missing user identity.',
      });
      return;
    }

    if (!req.supabase) {
      res.status(500).json({
        success: false,
        message: 'Internal server error: User database session is not available.',
      });
      return;
    }

    const { id } = req.params;
    if (!id || !UUID_REGEX.test(id)) {
      res.status(404).json({
        success: false,
        message: 'Complaint not found.',
      });
      return;
    }

    try {
      const comments = await ComplaintService.getComments(req.supabase, id);

      res.status(200).json({
        success: true,
        data: comments,
      });
    } catch (err: any) {
      const statusCode = err.statusCode || (err.code === '42501' ? 403 : 500);
      res.status(statusCode).json({
        success: false,
        message: err.message || 'Failed to retrieve comments.',
      });
    }
  }

  /**
   * GET /api/complaints/:id/timeline
   * Retrieves chronological audit timeline for a complaint visible under RLS.
   */
  public static async getTimeline(req: Request, res: Response): Promise<void> {
    if (!req.user || !req.user.id) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Missing user identity.',
      });
      return;
    }

    if (!req.supabase) {
      res.status(500).json({
        success: false,
        message: 'Internal server error: User database session is not available.',
      });
      return;
    }

    const { id } = req.params;
    if (!id || !UUID_REGEX.test(id)) {
      res.status(404).json({
        success: false,
        message: 'Complaint not found.',
      });
      return;
    }

    try {
      const timeline = await ComplaintService.getTimeline(req.supabase, id);

      res.status(200).json({
        success: true,
        data: timeline,
      });
    } catch (err: any) {
      const statusCode = err.statusCode || (err.code === '42501' ? 403 : 500);
      res.status(statusCode).json({
        success: false,
        message: err.message || 'Failed to retrieve timeline.',
      });
    }
  }
}
