import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '../config/supabase';
import {
  Notification,
  NotificationFilterQuery,
  CreateNotificationInput,
  Complaint,
  BroadcastNotification,
  CreateBroadcastInput,
} from '../types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class NotificationService {
  /**
   * Retrieves notifications belonging strictly to the authenticated user using their user-scoped Supabase client.
   * Row Level Security (RLS) ensures isolation.
   */
  public static async listNotifications(
    userClient: SupabaseClient,
    userId: string,
    filters: NotificationFilterQuery
  ): Promise<{ notifications: Notification[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, parseInt(String(filters.page || 1), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(filters.limit || 20), 10) || 20));
    const offset = (page - 1) * limit;

    let query = userClient
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    // Optional read/unread filter
    if (filters.read !== undefined) {
      const readVal = String(filters.read).toLowerCase();
      if (readVal === 'true') {
        query = query.eq('read', true);
      } else if (readVal === 'false') {
        query = query.eq('read', false);
      }
    }

    // Optional notification type filter
    if (filters.type && typeof filters.type === 'string') {
      const cleanType = filters.type.trim().toLowerCase();
      if (['info', 'success', 'warning', 'error'].includes(cleanType)) {
        query = query.eq('type', cleanType);
      }
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      const fetchErr: any = new Error(error.message || 'Failed to retrieve notifications.');
      fetchErr.statusCode = 500;
      throw fetchErr;
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      notifications: (data || []) as Notification[],
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Marks a single notification as read using the user-scoped client.
   * Returns null if the notification does not exist or does not belong to the user.
   */
  public static async markAsRead(
    userClient: SupabaseClient,
    notificationId: string,
    userId: string
  ): Promise<Notification | null> {
    if (!notificationId || !UUID_REGEX.test(notificationId)) {
      return null;
    }

    const { data, error } = await userClient
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as Notification;
  }

  /**
   * Marks all unread notifications belonging to the user as read.
   */
  public static async markAllAsRead(
    userClient: SupabaseClient,
    userId: string
  ): Promise<{ updatedCount: number }> {
    const { data, error } = await userClient
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)
      .select('id');

    if (error) {
      const err: any = new Error(error.message || 'Failed to mark notifications as read.');
      err.statusCode = 500;
      throw err;
    }

    return { updatedCount: data ? data.length : 0 };
  }

  /**
   * Retrieves the count of unread notifications belonging to the user.
   */
  public static async getUnreadCount(
    userClient: SupabaseClient,
    userId: string
  ): Promise<number> {
    const { count, error } = await userClient
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      const err: any = new Error(error.message || 'Failed to retrieve unread notification count.');
      err.statusCode = 500;
      throw err;
    }

    return count || 0;
  }

  /**
   * Creates an internal system notification using server admin client.
   * Includes recipient validation and duplicate mitigation.
   */
  public static async createNotification(input: CreateNotificationInput): Promise<Notification | null> {
    const targetUserId = (input.user_id || '').trim();
    if (!targetUserId || !UUID_REGEX.test(targetUserId)) {
      console.warn('[NotificationService] Invalid target user ID for notification:', targetUserId);
      return null;
    }

    const admin = getSupabaseAdmin();

    // Verify recipient profile exists
    const { data: recipient, error: recErr } = await admin
      .from('profiles')
      .select('id, status')
      .eq('id', targetUserId)
      .maybeSingle();

    if (recErr || !recipient || recipient.status === 'inactive') {
      console.warn('[NotificationService] Target recipient profile not active or not found:', targetUserId);
      return null;
    }

    // Deduplication check: avoid exact duplicate notifications created within the last 5 seconds
    if (input.complaint_id && input.category) {
      const recentWindow = new Date(Date.now() - 5000).toISOString();
      const { data: existingDup } = await admin
        .from('notifications')
        .select('id')
        .eq('user_id', targetUserId)
        .eq('complaint_id', input.complaint_id)
        .eq('category', input.category)
        .gte('created_at', recentWindow)
        .limit(1)
        .maybeSingle();

      if (existingDup) {
        return null;
      }
    }

    const payload = {
      user_id: targetUserId,
      title: input.title.trim(),
      message: input.message.trim(),
      type: input.type || 'info',
      category: input.category || null,
      complaint_id: input.complaint_id || null,
      broadcast_id: input.broadcast_id || null,
      read: false,
      link: input.link || null,
    };

    const { data, error } = await admin
      .from('notifications')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      console.warn('[NotificationService] Failed to insert notification:', error?.message);
      return null;
    }

    return data as Notification;
  }

  // ===========================================================================
  // Workflow Notification Dispatchers
  // ===========================================================================

  /**
   * Event A: Notify administrators when a new complaint is created.
   */
  public static async notifyAdminsOfNewComplaint(complaint: Complaint): Promise<void> {
    try {
      const admin = getSupabaseAdmin();
      const { data: admins } = await admin
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .eq('status', 'active');

      if (!admins || admins.length === 0) return;

      await Promise.all(
        admins.map((a) =>
          this.createNotification({
            user_id: a.id,
            title: 'New Complaint Submitted',
            message: `New complaint submitted: ${complaint.ticket_number} - "${complaint.title}".`,
            type: 'info',
            category: 'complaint_submitted',
            complaint_id: complaint.id,
            link: `/admin/complaints/${complaint.id}`,
          })
        )
      );
    } catch (err: any) {
      console.warn('[NotificationService] Error notifying admins of new complaint:', err?.message);
    }
  }

  /**
   * Event B: Notify assigned staff member upon complaint assignment or reassignment.
   */
  public static async notifyAssignee(
    complaint: Complaint,
    assignedToUserId: string,
    isReassignment: boolean
  ): Promise<void> {
    try {
      await this.createNotification({
        user_id: assignedToUserId,
        title: isReassignment ? 'Complaint Reassigned to You' : 'New Complaint Assigned',
        message: `Complaint ${complaint.ticket_number} ("${complaint.title}") has been assigned to you.`,
        type: 'info',
        category: 'complaint_assigned',
        complaint_id: complaint.id,
        link: `/staff/complaints/${complaint.id}`,
      });
    } catch (err: any) {
      console.warn('[NotificationService] Error notifying assignee:', err?.message);
    }
  }

  /**
   * Event C: Notify student when status is updated.
   */
  public static async notifyStudentOfStatusChange(
    complaint: Complaint,
    newStatus: string
  ): Promise<void> {
    try {
      const type = newStatus === 'rejected' ? 'warning' : 'info';
      await this.createNotification({
        user_id: complaint.student_id,
        title: 'Complaint Status Updated',
        message: `Your complaint ${complaint.ticket_number} status has been updated to "${newStatus}".`,
        type,
        category: 'status_changed',
        complaint_id: complaint.id,
        link: `/student/complaints/${complaint.id}`,
      });
    } catch (err: any) {
      console.warn('[NotificationService] Error notifying student of status change:', err?.message);
    }
  }

  /**
   * Event D: Notify student when complaint is resolved.
   */
  public static async notifyStudentOfResolution(complaint: Complaint): Promise<void> {
    try {
      await this.createNotification({
        user_id: complaint.student_id,
        title: 'Complaint Resolved',
        message: `Your complaint ${complaint.ticket_number} ("${complaint.title}") has been resolved.`,
        type: 'success',
        category: 'complaint_resolved',
        complaint_id: complaint.id,
        link: `/student/complaints/${complaint.id}`,
      });
    } catch (err: any) {
      console.warn('[NotificationService] Error notifying student of resolution:', err?.message);
    }
  }

  /**
   * Event E: Notify assigned staff and admins when complaint is reopened.
   */
  public static async notifyOfReopen(complaint: Complaint, reason: string): Promise<void> {
    try {
      // 1. If assigned, notify assigned staff
      if (complaint.assigned_to) {
        await this.createNotification({
          user_id: complaint.assigned_to,
          title: 'Complaint Reopened',
          message: `Complaint ${complaint.ticket_number} has been reopened by the student: "${reason}".`,
          type: 'warning',
          category: 'status_changed',
          complaint_id: complaint.id,
          link: `/staff/complaints/${complaint.id}`,
        });
      }

      // 2. Also notify active admins
      const admin = getSupabaseAdmin();
      const { data: admins } = await admin
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .eq('status', 'active');

      if (admins) {
        await Promise.all(
          admins
            .filter((a) => a.id !== complaint.assigned_to)
            .map((a) =>
              this.createNotification({
                user_id: a.id,
                title: 'Complaint Reopened',
                message: `Complaint ${complaint.ticket_number} was reopened: "${reason}".`,
                type: 'warning',
                category: 'status_changed',
                complaint_id: complaint.id,
                link: `/admin/complaints/${complaint.id}`,
              })
            )
        );
      }
    } catch (err: any) {
      console.warn('[NotificationService] Error notifying of complaint reopen:', err?.message);
    }
  }

  /**
   * Event F & G: Notify relevant participants when a comment is added.
   * If isInternal: strictly NEVER notify the student and never leak message text!
   */
  public static async notifyOfNewComment(
    complaint: Complaint,
    authorId: string,
    isInternal: boolean
  ): Promise<void> {
    try {
      // If internal comment, DO NOT notify the student!
      if (isInternal) {
        return;
      }

      // Public comment:
      // If author is student: notify assigned staff (or active admins if unassigned)
      if (authorId === complaint.student_id) {
        if (complaint.assigned_to) {
          await this.createNotification({
            user_id: complaint.assigned_to,
            title: 'New Comment on Complaint',
            message: `Student added a comment to complaint ${complaint.ticket_number}.`,
            type: 'info',
            category: 'admin_message',
            complaint_id: complaint.id,
            link: `/staff/complaints/${complaint.id}`,
          });
        } else {
          const admin = getSupabaseAdmin();
          const { data: admins } = await admin
            .from('profiles')
            .select('id')
            .eq('role', 'admin')
            .eq('status', 'active');

          if (admins) {
            await Promise.all(
              admins.map((a) =>
                this.createNotification({
                  user_id: a.id,
                  title: 'New Comment on Complaint',
                  message: `Student commented on unassigned complaint ${complaint.ticket_number}.`,
                  type: 'info',
                  category: 'admin_message',
                  complaint_id: complaint.id,
                  link: `/admin/complaints/${complaint.id}`,
                })
              )
            );
          }
        }
      } else {
        // Author is staff or admin: notify the student owner
        await this.createNotification({
          user_id: complaint.student_id,
          title: 'New Update on Your Complaint',
          message: `A staff member added a comment to your complaint ${complaint.ticket_number}.`,
          type: 'info',
          category: 'admin_message',
          complaint_id: complaint.id,
          link: `/student/complaints/${complaint.id}`,
        });
      }
    } catch (err: any) {
      console.warn('[NotificationService] Error notifying of new comment:', err?.message);
    }
  }

  /**
   * Dispatches a campus announcement broadcast and generates in-portal notifications for real student recipients.
   * Resolves target recipients strictly from public.profiles in PostgreSQL.
   */
  public static async broadcastNotification(
    adminUser: { id: string; role: string },
    payload: CreateBroadcastInput
  ): Promise<{ broadcast: BroadcastNotification; recipientCount: number }> {
    if (adminUser.role !== 'admin') {
      const err: any = new Error('Forbidden: Only administrators can dispatch broadcasts.');
      err.statusCode = 403;
      throw err;
    }

    const title = (payload.title || '').trim();
    const message = (payload.message || '').trim();
    if (!title) {
      const err: any = new Error('Broadcast title is required.');
      err.statusCode = 400;
      throw err;
    }
    if (!message) {
      const err: any = new Error('Broadcast message is required.');
      err.statusCode = 400;
      throw err;
    }

    const rawAudience = String(payload.audience || 'all_students');
    const audience = (rawAudience === 'all' ? 'all_students' : rawAudience) as 'all_students' | 'department' | 'student';
    if (!['all_students', 'department', 'student'].includes(audience)) {
      const err: any = new Error('Invalid audience type.');
      err.statusCode = 400;
      throw err;
    }

    const priority = (payload.priority || 'info') as 'info' | 'warning' | 'error';
    const targetDept = payload.targetDepartment || payload.target_department || null;
    const targetStudentId = payload.targetStudentId || payload.target_student_id || null;

    const admin = getSupabaseAdmin();

    // 1. Resolve real active student recipients from public.profiles
    let studentQuery = admin
      .from('profiles')
      .select('id, name, department, status, role')
      .eq('role', 'student')
      .eq('status', 'active');

    if (audience === 'department') {
      if (!targetDept || !targetDept.trim()) {
        const err: any = new Error('Please specify a target department.');
        err.statusCode = 400;
        throw err;
      }
      studentQuery = studentQuery.ilike('department', `%${targetDept.trim()}%`);
    } else if (audience === 'student') {
      if (!targetStudentId || !UUID_REGEX.test(targetStudentId.trim())) {
        const err: any = new Error('A valid target student ID (UUID) is required.');
        err.statusCode = 400;
        throw err;
      }
      studentQuery = studentQuery.eq('id', targetStudentId.trim());
    }

    const { data: realStudents, error: queryErr } = await studentQuery;
    if (queryErr) {
      const err: any = new Error(queryErr.message || 'Failed to query student recipients.');
      err.statusCode = 500;
      throw err;
    }

    const recipients = realStudents || [];

    // If 0 recipients found, record failed broadcast record and reject with 400
    if (recipients.length === 0) {
      try {
        await admin
          .from('broadcast_notifications')
          .insert({
            title,
            message,
            audience,
            target_department: targetDept ? targetDept.trim() : null,
            target_student_id: targetStudentId ? targetStudentId.trim() : null,
            priority,
            sent_by: adminUser.id,
            recipient_count: 0,
            status: 'failed',
          });
      } catch {
        // non-blocking
      }

      const err: any = new Error(
        audience === 'department'
          ? `No active students found in "${targetDept?.trim()}" department.`
          : 'No active student accounts found to receive this broadcast.'
      );
      err.statusCode = 400;
      throw err;
    }

    // 2. Insert broadcast record into public.broadcast_notifications
    const { data: broadcastRecord, error: bErr } = await admin
      .from('broadcast_notifications')
      .insert({
        title,
        message,
        audience,
        target_department: targetDept ? targetDept.trim() : null,
        target_student_id: targetStudentId ? targetStudentId.trim() : null,
        priority,
        sent_by: adminUser.id,
        recipient_count: recipients.length,
        status: 'delivered',
      })
      .select('*')
      .single();

    if (bErr || !broadcastRecord) {
      const err: any = new Error(bErr?.message || 'Failed to create broadcast notification.');
      err.statusCode = 500;
      throw err;
    }

    // 3. Batch create in-portal notification rows for all resolved students in public.notifications
    const notificationsToInsert = recipients.map((r) => ({
      user_id: r.id,
      broadcast_id: broadcastRecord.id,
      title: audience === 'department' && targetDept ? `[${targetDept.trim()}] ${title}` : title,
      message,
      type: priority,
      category: 'broadcast',
      read: false,
    }));

    const { error: notifErr } = await admin
      .from('notifications')
      .insert(notificationsToInsert);

    if (notifErr) {
      console.warn('[NotificationService] Warning: Failed to batch insert student notifications:', notifErr.message);
    }

    return {
      broadcast: broadcastRecord as BroadcastNotification,
      recipientCount: recipients.length,
    };
  }

  /**
   * Lists administrative broadcast history from public.broadcast_notifications.
   */
  public static async listBroadcasts(
    userClient: SupabaseClient
  ): Promise<BroadcastNotification[]> {
    const { data, error } = await userClient
      .from('broadcast_notifications')
      .select('*')
      .order('sent_at', { ascending: false });

    if (error) {
      const err: any = new Error(error.message || 'Failed to retrieve broadcast notifications.');
      err.statusCode = 500;
      throw err;
    }

    return (data || []) as BroadcastNotification[];
  }
}
