import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '../config/supabase';
import {
  Complaint,
  CreateComplaintInput,
  ComplaintFilterQuery,
  ComplaintPriority,
  ComplaintStatus,
  AssignComplaintInput,
  UpdateComplaintStatusInput,
  ReopenComplaintInput,
  CreateCommentInput,
  ComplaintComment,
  ComplaintTimelineEvent,
} from '../types';
import { NotificationService } from './notificationService';

export class ComplaintService {
  /**
   * Generates a unique, sequential, human-readable ticket number.
   * Format: SCCP-YYYY-XXXXXX (e.g., SCCP-2026-100001)
   * Uses server admin client to read global max sequence without RLS blindspots.
   */
  public static async generateTicketNumber(_userClient?: SupabaseClient): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `SCCP-${year}-`;
    const admin = getSupabaseAdmin();

    // Query highest current sequence number for the current year across all complaints
    const { data: highestTicket } = await admin
      .from('complaints')
      .select('ticket_number')
      .ilike('ticket_number', `${prefix}%`)
      .order('ticket_number', { ascending: false })
      .limit(1);

    let nextSeq = 100001;

    if (highestTicket && highestTicket.length > 0 && highestTicket[0].ticket_number) {
      const match = highestTicket[0].ticket_number.match(/SCCP-\d{4}-(\d+)/);
      if (match && match[1]) {
        const parsed = parseInt(match[1], 10);
        if (!isNaN(parsed) && parsed >= 100001) {
          nextSeq = parsed + 1;
        }
      }
    }

    // Safety loop to ensure uniqueness against existing records
    let candidate = `${prefix}${String(nextSeq).padStart(6, '0')}`;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 20) {
      const { data: existing } = await admin
        .from('complaints')
        .select('id')
        .eq('ticket_number', candidate)
        .limit(1)
        .maybeSingle();

      if (!existing) {
        isUnique = true;
      } else {
        nextSeq++;
        candidate = `${prefix}${String(nextSeq).padStart(6, '0')}`;
        attempts++;
      }
    }

    return candidate;
  }

  /**
   * Resolves category ID, slug, and name from user input.
   * Supports UUIDs, slugs (e.g. 'electrical'), and human names (e.g. 'Electrical & Power').
   */
  public static async resolveCategory(
    client: SupabaseClient,
    categoryInput: string
  ): Promise<{ id: string; slug: string; name: string }> {
    const trimmed = (categoryInput || '').trim();
    if (!trimmed) {
      const err: any = new Error('Category is required.');
      err.statusCode = 400;
      throw err;
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);

    let query = client
      .from('categories')
      .select('id, name, slug, active')
      .eq('active', true);

    if (isUuid) {
      query = query.eq('id', trimmed);
    } else {
      query = query.or(`slug.eq.${trimmed.toLowerCase()},name.ilike.${trimmed}`);
    }

    const { data: categories, error } = await query.limit(1);

    if (error || !categories || categories.length === 0) {
      const err: any = new Error(`Invalid category "${trimmed}". Please provide an active category name, slug, or ID.`);
      err.statusCode = 400;
      throw err;
    }

    return {
      id: categories[0].id,
      slug: categories[0].slug,
      name: categories[0].name,
    };
  }

  /**
   * Creates a new complaint for an authenticated student using the user-scoped Supabase client.
   * Enforces server-side ticket generation, initial pending status, and author ownership.
   */
  public static async createComplaint(
    userClient: SupabaseClient,
    studentId: string,
    input: CreateComplaintInput
  ): Promise<Complaint> {
    // 1. Resolve category
    const category = await this.resolveCategory(userClient, input.category);

    // 2. Generate unique ticket number
    const ticketNumber = await this.generateTicketNumber(userClient);

    // 3. Format priority
    const priority: ComplaintPriority = (input.priority || 'medium').toLowerCase() as ComplaintPriority;

    // 4. Compose location
    const building = input.building?.trim() || null;
    const floor = input.floor?.trim() || null;
    const roomNumber = (input.room_number || input.roomNumber)?.trim() || null;
    let location = input.location?.trim() || null;
    if (!location && building) {
      location = [building, floor, roomNumber ? `Room ${roomNumber}` : null].filter(Boolean).join(', ');
    }

    // 5. Build strict insert payload (no client overrides for ownership, status, or assignment)
    const payload = {
      ticket_number: ticketNumber,
      title: input.title.trim(),
      description: input.description.trim(),
      category_id: category.id,
      category_slug: category.slug,
      priority,
      status: 'pending' as const,
      student_id: studentId,
      department: input.department?.trim() || null,
      building,
      floor,
      room_number: roomNumber,
      location,
      additional_details: (input.additional_details || input.additionalDetails)?.trim() || null,
      assigned_to: null,
      assigned_department: null,
    };

    // 6. Execute insert under PostgreSQL Row Level Security (RLS) with collision retry
    let created: any = null;
    let attempts = 0;
    while (!created && attempts < 3) {
      if (attempts > 0) {
        payload.ticket_number = await this.generateTicketNumber(userClient);
      }
      const { data, error } = await userClient
        .from('complaints')
        .insert(payload)
        .select('*')
        .single();

      if (!error && data) {
        created = data;
        break;
      }

      if (error?.code === '23505') {
        attempts++;
        if (attempts >= 3) {
          const conflictErr: any = new Error('A complaint with this ticket number already exists. Please retry.');
          conflictErr.statusCode = 409;
          throw conflictErr;
        }
        continue;
      }

      const insertErr: any = new Error(error?.message || 'Failed to create complaint in database.');
      insertErr.statusCode = error?.code === '42501' ? 403 : 500;
      throw insertErr;
    }

    // Dispatch notification to admins
    try {
      await NotificationService.notifyAdminsOfNewComplaint(created as Complaint);
    } catch (err: any) {
      console.warn('[ComplaintService] Warning: Failed to send new complaint notification:', err?.message);
    }

    return created as Complaint;
  }

  /**
   * Retrieves complaints visible to the authenticated user under Row Level Security (RLS).
   * - Students: only their own complaints (student_id = auth.uid())
   * - Staff: complaints assigned to them (assigned_to = auth.uid())
   * - Admin: all complaints
   */
  public static async listComplaints(
    userClient: SupabaseClient,
    filters: ComplaintFilterQuery
  ): Promise<{ complaints: Complaint[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, parseInt(String(filters.page || 1), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(filters.limit || 20), 10) || 20));
    const offset = (page - 1) * limit;

    let query = userClient
      .from('complaints')
      .select('*', { count: 'exact' });

    // Optional status filter
    if (filters.status && typeof filters.status === 'string') {
      const cleanStatus = filters.status.trim().toLowerCase();
      if (['pending', 'assigned', 'in_progress', 'resolved', 'rejected'].includes(cleanStatus)) {
        query = query.eq('status', cleanStatus);
      }
    }

    // Optional priority filter
    if (filters.priority && typeof filters.priority === 'string') {
      const cleanPriority = filters.priority.trim().toLowerCase();
      if (['low', 'medium', 'high', 'critical'].includes(cleanPriority)) {
        query = query.eq('priority', cleanPriority);
      }
    }

    // Optional category filter
    if (filters.category && typeof filters.category === 'string') {
      const cleanCat = filters.category.trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanCat);
      if (isUuid) {
        query = query.eq('category_id', cleanCat);
      } else {
        query = query.eq('category_slug', cleanCat.toLowerCase());
      }
    }

    // Ordering and Pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      const fetchErr: any = new Error(error.message || 'Failed to retrieve complaints.');
      fetchErr.statusCode = 500;
      throw fetchErr;
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      complaints: (data || []) as Complaint[],
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Retrieves a single complaint by ID.
   * Under RLS, if the complaint belongs to another user and the caller is not authorized,
   * PostgreSQL returns 0 rows, resulting in null.
   */
  public static async getComplaintById(
    userClient: SupabaseClient,
    id: string
  ): Promise<Complaint | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUuid) {
      return null;
    }

    const { data, error } = await userClient
      .from('complaints')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as Complaint;
  }

  /**
   * Retrieves a single complaint by Ticket Number.
   * Under RLS, returns null if caller is not authorized to view the complaint.
   */
  public static async getComplaintByTicketNumber(
    userClient: SupabaseClient,
    ticketNumber: string
  ): Promise<Complaint | null> {
    const cleanTicket = (ticketNumber || '').trim();
    if (!cleanTicket) {
      return null;
    }

    const { data, error } = await userClient
      .from('complaints')
      .select('*')
      .eq('ticket_number', cleanTicket)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as Complaint;
  }

  /**
   * Allowed Status Transition State Machine.
   */
  public static readonly ALLOWED_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
    pending: ['assigned', 'in_progress', 'rejected'],
    assigned: ['in_progress', 'rejected', 'pending'],
    in_progress: ['resolved', 'rejected', 'pending'],
    resolved: ['pending', 'in_progress'],
    rejected: ['pending', 'in_progress'],
  };

  /**
   * Assigns a complaint to an active staff member (Admin only).
   * Validates target staff role and existence.
   * Auto-updates status from 'pending' to 'assigned'.
   * Creates an audit timeline entry.
   */
  public static async assignComplaint(
    userClient: SupabaseClient,
    complaintId: string,
    input: AssignComplaintInput,
    adminUser: { id: string; role: string }
  ): Promise<Complaint> {
    if (adminUser.role !== 'admin') {
      const err: any = new Error('Forbidden: Only administrators can assign complaints.');
      err.statusCode = 403;
      throw err;
    }

    const targetStaffId = (input.assigned_to || '').trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetStaffId);
    if (!targetStaffId || !isUuid) {
      const err: any = new Error('A valid staff user ID (UUID) is required.');
      err.statusCode = 400;
      throw err;
    }

    // Validate target staff profile in public.profiles
    const { data: staffProfile, error: profileErr } = await userClient
      .from('profiles')
      .select('id, name, role, status, department')
      .eq('id', targetStaffId)
      .maybeSingle();

    if (profileErr || !staffProfile || staffProfile.role !== 'staff' || staffProfile.status !== 'active') {
      const err: any = new Error('Assigned user must be an active staff member.');
      err.statusCode = 400;
      throw err;
    }

    // Load complaint
    const complaint = await this.getComplaintById(userClient, complaintId);
    if (!complaint) {
      const err: any = new Error('Complaint not found.');
      err.statusCode = 404;
      throw err;
    }

    // Resolve department
    const department = input.assigned_department?.trim() || staffProfile.department || null;
    if (input.assigned_department && input.assigned_department.trim().length > 100) {
      const err: any = new Error('Assigned department cannot exceed 100 characters.');
      err.statusCode = 400;
      throw err;
    }

    // Determine new status: auto-transition 'pending' to 'assigned'
    const newStatus: ComplaintStatus = complaint.status === 'pending' ? 'assigned' : complaint.status;

    // Execute update under RLS
    const updatePayload: Record<string, any> = {
      assigned_to: targetStaffId,
      assigned_department: department,
      status: newStatus,
    };

    const { data: updatedComplaint, error: updateErr } = await userClient
      .from('complaints')
      .update(updatePayload)
      .eq('id', complaintId)
      .select('*')
      .single();

    if (updateErr || !updatedComplaint) {
      const err: any = new Error(updateErr?.message || 'Failed to assign complaint.');
      err.statusCode = updateErr?.code === '42501' ? 403 : 500;
      throw err;
    }

    // Create timeline entry
    const isReassignment = Boolean(complaint.assigned_to && complaint.assigned_to !== targetStaffId);
    const action = isReassignment ? 'reassigned' : 'assigned';
    const staffLabel = staffProfile.name || 'Staff Member';
    const deptLabel = department ? ` (${department})` : '';
    const message = input.notes?.trim() || `Assigned to ${staffLabel}${deptLabel}.`;

    try {
      await userClient.from('complaint_timeline').insert({
        complaint_id: complaintId,
        status: newStatus,
        action,
        message,
        updated_by: adminUser.id,
        is_internal: false,
      });
    } catch (timelineErr: any) {
      console.warn('[ComplaintService] Warning: Failed to record timeline event:', timelineErr?.message);
    }

    // Dispatch notification to newly assigned staff member
    try {
      await NotificationService.notifyAssignee(updatedComplaint as Complaint, targetStaffId, isReassignment);
    } catch (err: any) {
      console.warn('[ComplaintService] Warning: Failed to send assignment notification:', err?.message);
    }

    return updatedComplaint as Complaint;
  }

  /**
   * Updates complaint status following the strict state machine (Staff or Admin).
   * Enforces role authority, transitions, server-side resolved_at timestamps, and timeline tracking.
   */
  public static async updateComplaintStatus(
    userClient: SupabaseClient,
    complaintId: string,
    input: UpdateComplaintStatusInput,
    user: { id: string; role: string }
  ): Promise<Complaint> {
    if (user.role === 'student') {
      const err: any = new Error('Forbidden: Students are not authorized to update complaint status directly.');
      err.statusCode = 403;
      throw err;
    }

    const complaint = await this.getComplaintById(userClient, complaintId);
    if (!complaint) {
      const err: any = new Error('Complaint not found.');
      err.statusCode = 404;
      throw err;
    }

    // Staff can only update complaints assigned to them
    if (user.role === 'staff' && complaint.assigned_to !== user.id) {
      const err: any = new Error('Forbidden: Staff members can only update complaints assigned to them.');
      err.statusCode = 403;
      throw err;
    }

    // Validate target status
    const targetStatus = (input.status || '').trim().toLowerCase() as ComplaintStatus;
    const validStatuses: ComplaintStatus[] = ['pending', 'assigned', 'in_progress', 'resolved', 'rejected'];
    if (!validStatuses.includes(targetStatus)) {
      const err: any = new Error(`Invalid status "${input.status}". Allowed values: ${validStatuses.join(', ')}.`);
      err.statusCode = 400;
      throw err;
    }

    if (complaint.status === targetStatus) {
      const err: any = new Error(`Complaint is already in "${targetStatus}" status.`);
      err.statusCode = 400;
      throw err;
    }

    // Enforce transition rules
    const allowed = this.ALLOWED_TRANSITIONS[complaint.status] || [];
    if (!allowed.includes(targetStatus)) {
      const err: any = new Error(`Invalid status transition from "${complaint.status}" to "${targetStatus}".`);
      err.statusCode = 400;
      throw err;
    }

    const updatePayload: Record<string, any> = {
      status: targetStatus,
    };

    if (targetStatus === 'resolved') {
      updatePayload.resolved_at = new Date().toISOString();
    } else if (complaint.status === 'resolved') {
      updatePayload.resolved_at = null;
    }

    if (input.estimated_resolution_date) {
      updatePayload.estimated_resolution_date = input.estimated_resolution_date;
    }

    const { data: updatedComplaint, error: updateErr } = await userClient
      .from('complaints')
      .update(updatePayload)
      .eq('id', complaintId)
      .select('*')
      .single();

    if (updateErr || !updatedComplaint) {
      const err: any = new Error(updateErr?.message || 'Failed to update complaint status.');
      err.statusCode = updateErr?.code === '42501' ? 403 : 500;
      throw err;
    }

    // Create timeline entry
    let action = 'status_updated';
    if (targetStatus === 'resolved') action = 'resolved';
    else if (targetStatus === 'rejected') action = 'rejected';
    else if (targetStatus === 'in_progress') action = 'in_progress';
    else if (targetStatus === 'assigned') action = 'assigned';

    const defaultMsg = targetStatus === 'resolved'
      ? 'Complaint has been marked as resolved.'
      : (targetStatus === 'rejected'
        ? 'Complaint has been rejected.'
        : `Status updated from ${complaint.status} to ${targetStatus}.`);

    const message = input.notes?.trim() || input.resolution_notes?.trim() || defaultMsg;

    try {
      await userClient.from('complaint_timeline').insert({
        complaint_id: complaintId,
        status: targetStatus,
        action,
        message,
        updated_by: user.id,
        is_internal: false,
      });
    } catch (timelineErr: any) {
      console.warn('[ComplaintService] Warning: Failed to record timeline event:', timelineErr?.message);
    }

    // Dispatch notification to complaint owner
    try {
      if (targetStatus === 'resolved') {
        await NotificationService.notifyStudentOfResolution(updatedComplaint as Complaint);
      } else {
        await NotificationService.notifyStudentOfStatusChange(updatedComplaint as Complaint, targetStatus);
      }
    } catch (err: any) {
      console.warn('[ComplaintService] Warning: Failed to send status change notification:', err?.message);
    }

    return updatedComplaint as Complaint;
  }

  /**
   * Reopens a resolved or rejected complaint back to 'pending' (Student owner or Admin).
   * Enforces ownership, current status, reopen reason, and timeline event.
   */
  public static async reopenComplaint(
    userClient: SupabaseClient,
    complaintId: string,
    input: ReopenComplaintInput,
    user: { id: string; role: string }
  ): Promise<Complaint> {
    if (user.role === 'staff') {
      const err: any = new Error('Forbidden: Staff members cannot reopen complaints.');
      err.statusCode = 403;
      throw err;
    }

    const complaint = await this.getComplaintById(userClient, complaintId);
    if (!complaint) {
      const err: any = new Error('Complaint not found.');
      err.statusCode = 404;
      throw err;
    }

    if (user.role === 'student' && complaint.student_id !== user.id) {
      const err: any = new Error('Complaint not found.');
      err.statusCode = 404;
      throw err;
    }

    if (complaint.status !== 'resolved' && complaint.status !== 'rejected') {
      const err: any = new Error(`Only resolved or rejected complaints can be reopened. Current status is "${complaint.status}".`);
      err.statusCode = 400;
      throw err;
    }

    const reason = (input.reason || '').trim();
    if (!reason || reason.length < 5) {
      const err: any = new Error('A valid reopen reason of at least 5 characters is required.');
      err.statusCode = 400;
      throw err;
    }
    if (reason.length > 1000) {
      const err: any = new Error('Reopen reason cannot exceed 1000 characters.');
      err.statusCode = 400;
      throw err;
    }

    const updatePayload = {
      status: 'pending' as const,
      reopen_reason: reason,
      reopened_at: new Date().toISOString(),
      resolved_at: null,
    };

    const { data: updatedComplaint, error: updateErr } = await userClient
      .from('complaints')
      .update(updatePayload)
      .eq('id', complaintId)
      .select('*')
      .single();

    if (updateErr || !updatedComplaint) {
      const err: any = new Error(updateErr?.message || 'Failed to reopen complaint.');
      err.statusCode = updateErr?.code === '42501' ? 403 : 500;
      throw err;
    }

    try {
      await userClient.from('complaint_timeline').insert({
        complaint_id: complaintId,
        status: 'pending',
        action: 'reopened',
        message: `Complaint reopened: ${reason}`,
        updated_by: user.id,
        is_internal: false,
      });
    } catch (timelineErr: any) {
      console.warn('[ComplaintService] Warning: Failed to record timeline event:', timelineErr?.message);
    }

    // Dispatch notification to assigned staff and admins
    try {
      await NotificationService.notifyOfReopen(updatedComplaint as Complaint, reason);
    } catch (err: any) {
      console.warn('[ComplaintService] Warning: Failed to send reopen notification:', err?.message);
    }

    return updatedComplaint as Complaint;
  }

  /**
   * Adds a public or internal comment to a complaint.
   * Internal comments (is_internal = true) are strictly restricted to administrators.
   */
  public static async addComment(
    userClient: SupabaseClient,
    complaintId: string,
    input: CreateCommentInput,
    user: { id: string; role: string }
  ): Promise<ComplaintComment> {
    const complaint = await this.getComplaintById(userClient, complaintId);
    if (!complaint) {
      const err: any = new Error('Complaint not found.');
      err.statusCode = 404;
      throw err;
    }

    const message = (input.message || '').trim();
    if (!message || message.length < 1) {
      const err: any = new Error('Comment message cannot be empty.');
      err.statusCode = 400;
      throw err;
    }
    if (message.length > 2000) {
      const err: any = new Error('Comment message cannot exceed 2000 characters.');
      err.statusCode = 400;
      throw err;
    }

    if (input.is_internal === true && user.role !== 'admin') {
      const err: any = new Error('Forbidden: Only administrators can create internal comments.');
      err.statusCode = 403;
      throw err;
    }

    const isInternal = user.role === 'admin' ? Boolean(input.is_internal) : false;

    const { data: comment, error: insertErr } = await userClient
      .from('complaint_comments')
      .insert({
        complaint_id: complaintId,
        author_id: user.id,
        message,
        is_internal: isInternal,
      })
      .select('*')
      .single();

    if (insertErr || !comment) {
      const err: any = new Error(insertErr?.message || 'Failed to add comment.');
      err.statusCode = insertErr?.code === '42501' ? 403 : 500;
      throw err;
    }

    // Dispatch notification to relevant participants (never if internal comment)
    try {
      await NotificationService.notifyOfNewComment(complaint, user.id, isInternal);
    } catch (err: any) {
      console.warn('[ComplaintService] Warning: Failed to send comment notification:', err?.message);
    }

    return comment as ComplaintComment;
  }

  /**
   * Lists comments for a complaint visible under Row Level Security.
   * Students and staff only see public comments (is_internal = false).
   * Admins see both public and internal comments.
   */
  public static async getComments(
    userClient: SupabaseClient,
    complaintId: string
  ): Promise<ComplaintComment[]> {
    const complaint = await this.getComplaintById(userClient, complaintId);
    if (!complaint) {
      const err: any = new Error('Complaint not found.');
      err.statusCode = 404;
      throw err;
    }

    const { data, error } = await userClient
      .from('complaint_comments')
      .select('*')
      .eq('complaint_id', complaintId)
      .order('created_at', { ascending: true });

    if (error) {
      const err: any = new Error(error.message || 'Failed to retrieve comments.');
      err.statusCode = 500;
      throw err;
    }

    return (data || []) as ComplaintComment[];
  }

  /**
   * Lists timeline events for a complaint visible under Row Level Security.
   * Students and staff only see public events (is_internal = false).
   * Admins see both public and internal events.
   */
  public static async getTimeline(
    userClient: SupabaseClient,
    complaintId: string
  ): Promise<ComplaintTimelineEvent[]> {
    const complaint = await this.getComplaintById(userClient, complaintId);
    if (!complaint) {
      const err: any = new Error('Complaint not found.');
      err.statusCode = 404;
      throw err;
    }

    const { data, error } = await userClient
      .from('complaint_timeline')
      .select('*')
      .eq('complaint_id', complaintId)
      .order('created_at', { ascending: true });

    if (error) {
      const err: any = new Error(error.message || 'Failed to retrieve timeline.');
      err.statusCode = 500;
      throw err;
    }

    return (data || []) as ComplaintTimelineEvent[];
  }
}
