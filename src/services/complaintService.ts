import type {
  Complaint,
  ComplaintStatus,
  Priority,
  FilterOptions,
  TimelineEvent,
  StudentComplaintStats,
  StudentActivityEvent,
  ComplaintComment,
  AdminKPIStats,
  AdminActivityEvent,
} from '@/types';
import { STORAGE_KEYS, getStorageItem, setStorageItem } from '@/utils/storage';
import { MOCK_COMPLAINTS } from '@/data/mockData';
import { authService } from './authService';
import { notificationService } from './notificationService';

/**
 * Complaint Service
 * Manages fetching, filtering, creating, and updating complaint data.
 */
class ComplaintService {
  private ensureInitialized(): void {
    const existing = getStorageItem<Complaint[] | null>(STORAGE_KEYS.COMPLAINTS, null);
    if (!existing || existing.length === 0) {
      setStorageItem(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS);
    }
  }

  public async getComplaints(filter?: FilterOptions): Promise<Complaint[]> {
    this.ensureInitialized();
    let complaints = getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS);

    if (!filter) return complaints;

    if (filter.status && filter.status !== 'all') {
      complaints = complaints.filter((c) => c.status === filter.status);
    }
    if (filter.priority && filter.priority !== 'all') {
      complaints = complaints.filter((c) => c.priority === filter.priority);
    }
    if (filter.category && filter.category !== 'all') {
      complaints = complaints.filter((c) => c.category === filter.category);
    }
    if (filter.searchQuery && filter.searchQuery.trim() !== '') {
      const q = filter.searchQuery.toLowerCase();
      complaints = complaints.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.ticketNumber.toLowerCase().includes(q) ||
          (c.location && c.location.toLowerCase().includes(q))
      );
    }

    return complaints;
  }

  public async getComplaintById(
    id: string,
    filterInternal: boolean = true
  ): Promise<Complaint | null> {
    this.ensureInitialized();
    const complaints = getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS);
    const item = complaints.find((c) => c.id === id || c.ticketNumber === id) || null;
    if (!item) return null;

    const currentUser = authService.getCurrentUser();
    const shouldFilter = filterInternal && currentUser?.role !== 'admin';

    if (shouldFilter) {
      return {
        ...item,
        timeline: item.timeline.filter((t) => !t.isInternal),
        comments: item.comments?.filter((c) => !c.isInternal),
      };
    }

    return item;
  }

  public async getStudentComplaints(studentIdOrEmail: string): Promise<Complaint[]> {
    this.ensureInitialized();
    const complaints = getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS);
    return complaints
      .filter((c) => c.studentId === studentIdOrEmail || c.studentEmail === studentIdOrEmail)
      .map((c) => ({
        ...c,
        timeline: c.timeline.filter((t) => !t.isInternal),
        comments: c.comments?.filter((cm) => !cm.isInternal),
      }));
  }

  public async getStudentStats(studentIdOrEmail: string): Promise<StudentComplaintStats> {
    const complaints = await this.getStudentComplaints(studentIdOrEmail);
    const byStatus: Record<ComplaintStatus, number> = {
      pending: 0,
      assigned: 0,
      in_progress: 0,
      resolved: 0,
      rejected: 0,
    };

    complaints.forEach((c) => {
      if (byStatus[c.status] !== undefined) {
        byStatus[c.status]++;
      }
    });

    return {
      total: complaints.length,
      pending: byStatus.pending,
      assigned: byStatus.assigned,
      inProgress: byStatus.in_progress,
      resolved: byStatus.resolved,
      rejected: byStatus.rejected,
      byStatus,
    };
  }

  public async getStudentRecentActivity(
    studentIdOrEmail: string,
    limit: number = 6
  ): Promise<StudentActivityEvent[]> {
    const complaints = await this.getStudentComplaints(studentIdOrEmail);
    const events: StudentActivityEvent[] = [];

    complaints.forEach((complaint) => {
      if (Array.isArray(complaint.timeline)) {
        complaint.timeline.forEach((tl) => {
          events.push({
            ...tl,
            ticketNumber: complaint.ticketNumber,
            complaintTitle: complaint.title,
          });
        });
      }
    });

    // Sort descending by timestamp
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return events.slice(0, limit);
  }

  public async createComplaint(
    data: Omit<Complaint, 'id' | 'ticketNumber' | 'createdAt' | 'updatedAt' | 'timeline'>
  ): Promise<Complaint> {
    this.ensureInitialized();
    const complaints = getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS);
    const currentUser = authService.getCurrentUser();

    const timestamp = new Date().toISOString();

    // Determine next sequential ID (CMP-1001, CMP-1002, CMP-1003...)
    let maxSeq = 1000;
    complaints.forEach((c) => {
      const match = c.ticketNumber.match(/CMP-(?:2026-)?0*(\d+)/i) || c.id.match(/cmp-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    });

    const nextSeq = maxSeq + 1;
    const ticketNumber = `CMP-${nextSeq}`;
    const id = `cmp-${nextSeq}`;

    const initialTimeline: TimelineEvent = {
      id: `tl-${Date.now()}`,
      complaintId: id,
      status: 'pending',
      message: 'Complaint submitted by student.',
      updatedBy: currentUser?.name || data.studentName || 'Student',
      role: 'student',
      timestamp,
    };

    const newComplaint: Complaint = {
      ...data,
      id,
      ticketNumber,
      status: 'pending',
      createdAt: timestamp,
      updatedAt: timestamp,
      timeline: [initialTimeline],
    };

    const updatedList = [newComplaint, ...complaints];
    setStorageItem(STORAGE_KEYS.COMPLAINTS, updatedList);

    // Create admin notification
    try {
      await notificationService.createNotification({
        userId: 'user-admin-1',
        title: 'New Complaint Submitted',
        message: `${ticketNumber}: ${newComplaint.title} (${newComplaint.category} - ${newComplaint.priority.toUpperCase()} priority)`,
        type: newComplaint.priority === 'critical' ? 'warning' : 'info',
        link: `/admin/complaints/${id}`,
      });
    } catch (e) {
      console.warn('Could not dispatch admin notification:', e);
    }

    return newComplaint;
  }

  public async updateComplaintStatus(
    id: string,
    status: ComplaintStatus,
    message: string,
    isInternal: boolean = false,
    notifyStudent: boolean = true
  ): Promise<Complaint> {
    this.ensureInitialized();
    const complaints = getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS);
    const currentUser = authService.getCurrentUser();
    const index = complaints.findIndex((c) => c.id === id || c.ticketNumber === id);

    if (index === -1) {
      throw new Error(`Complaint with ID ${id} not found`);
    }

    const timestamp = new Date().toISOString();
    const complaint = complaints[index];

    const newEvent: TimelineEvent = {
      id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      complaintId: complaint.id,
      status,
      message,
      updatedBy: currentUser?.name || 'Administrator',
      role: currentUser?.role || 'admin',
      timestamp,
      isInternal,
    };

    const isResolved = status === 'resolved';

    const updated: Complaint = {
      ...complaint,
      status,
      updatedAt: timestamp,
      resolvedAt: isResolved ? timestamp : (status === 'in_progress' || status === 'pending' || status === 'assigned') ? undefined : complaint.resolvedAt,
      timeline: [...complaint.timeline, newEvent],
    };

    complaints[index] = updated;
    setStorageItem(STORAGE_KEYS.COMPLAINTS, complaints);

    // Automatic Notification: notify student only if not internal and notifyStudent is true
    if (!isInternal && notifyStudent) {
      try {
        await notificationService.createNotification({
          userId: complaint.studentId,
          title: isResolved ? 'Complaint Resolved' : 'Status Updated',
          message: isResolved
            ? `Your ticket ${complaint.ticketNumber} has been resolved: "${message}"`
            : `Ticket ${complaint.ticketNumber} status is now ${status.replace('_', ' ').toUpperCase()}: "${message}"`,
          type: isResolved ? 'success' : status === 'rejected' ? 'error' : 'info',
          category: isResolved ? 'complaint_resolved' : 'status_changed',
          complaintId: complaint.id,
          link: `/student/complaints/${complaint.id}`,
        });
      } catch (e) {
        console.warn('Could not dispatch status change notification to student:', e);
      }
    }

    return updated;
  }

  // Alias for updateComplaintStatus
  public async updateStatus(
    id: string,
    status: ComplaintStatus,
    message: string,
    isInternal: boolean = false,
    notifyStudent: boolean = true
  ): Promise<Complaint> {
    return this.updateComplaintStatus(id, status, message, isInternal, notifyStudent);
  }

  public async assignComplaint(
    id: string,
    staffId: string,
    staffName: string,
    department?: string,
    notifyStudent: boolean = true
  ): Promise<Complaint> {
    this.ensureInitialized();
    const complaints = getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS);
    const currentUser = authService.getCurrentUser();
    const index = complaints.findIndex((c) => c.id === id || c.ticketNumber === id);

    if (index === -1) {
      throw new Error(`Complaint with ID ${id} not found`);
    }

    const timestamp = new Date().toISOString();
    const complaint = complaints[index];

    // Update status to 'assigned' if currently 'pending'
    const newStatus: ComplaintStatus = complaint.status === 'pending' ? 'assigned' : complaint.status;

    const assignmentDesc = department
      ? `Assigned to ${staffName} (${department} Department).`
      : `Assigned to ${staffName}.`;

    const newEvent: TimelineEvent = {
      id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      complaintId: complaint.id,
      status: newStatus,
      message: assignmentDesc,
      updatedBy: currentUser?.name || 'Administrator',
      role: currentUser?.role || 'admin',
      timestamp,
      isInternal: false,
    };

    const updated: Complaint = {
      ...complaint,
      status: newStatus,
      assignedTo: staffId,
      assignedStaffName: staffName,
      assignedDepartment: department || complaint.assignedDepartment,
      updatedAt: timestamp,
      timeline: [...complaint.timeline, newEvent],
    };

    complaints[index] = updated;
    setStorageItem(STORAGE_KEYS.COMPLAINTS, complaints);

    // Automatic Notification: notify student that technician has been assigned
    if (notifyStudent) {
      try {
        await notificationService.createNotification({
          userId: complaint.studentId,
          title: 'Technician Assigned',
          message: `Technician ${staffName}${department ? ` (${department})` : ''} has been assigned to ticket ${complaint.ticketNumber}.`,
          type: 'info',
          category: 'complaint_assigned',
          complaintId: complaint.id,
          link: `/student/complaints/${complaint.id}`,
        });
      } catch (e) {
        console.warn('Could not dispatch assignment notification to student:', e);
      }
    }

    return updated;
  }

  public async updatePriority(
    id: string,
    priority: Priority,
    notifyStudent: boolean = false
  ): Promise<Complaint> {
    this.ensureInitialized();
    const complaints = getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS);
    const currentUser = authService.getCurrentUser();
    const index = complaints.findIndex((c) => c.id === id || c.ticketNumber === id);

    if (index === -1) {
      throw new Error(`Complaint with ID ${id} not found`);
    }

    const timestamp = new Date().toISOString();
    const complaint = complaints[index];

    const newEvent: TimelineEvent = {
      id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      complaintId: complaint.id,
      status: complaint.status,
      message: `Priority adjusted to ${priority.toUpperCase()} by Administrator.`,
      updatedBy: currentUser?.name || 'Administrator',
      role: currentUser?.role || 'admin',
      timestamp,
      isInternal: false,
    };

    const updated: Complaint = {
      ...complaint,
      priority,
      updatedAt: timestamp,
      timeline: [...complaint.timeline, newEvent],
    };

    complaints[index] = updated;
    setStorageItem(STORAGE_KEYS.COMPLAINTS, complaints);

    if (notifyStudent) {
      try {
        await notificationService.createNotification({
          userId: complaint.studentId,
          title: 'Priority Updated',
          message: `Ticket ${complaint.ticketNumber} priority changed to ${priority.toUpperCase()}.`,
          type: 'info',
          category: 'status_changed',
          complaintId: complaint.id,
          link: `/student/complaints/${complaint.id}`,
        });
      } catch (e) {
        console.warn('Could not dispatch priority notification to student:', e);
      }
    }

    return updated;
  }

  public async bulkUpdateStatus(
    ids: string[],
    newStatus: ComplaintStatus,
    message: string,
    notifyStudent: boolean = true
  ): Promise<Complaint[]> {
    this.ensureInitialized();
    const complaints = getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS);
    const currentUser = authService.getCurrentUser();
    const timestamp = new Date().toISOString();
    const idSet = new Set(ids);

    const updatedComplaints: Complaint[] = [];

    const updatedList = complaints.map((complaint) => {
      if (!idSet.has(complaint.id) && !idSet.has(complaint.ticketNumber)) {
        return complaint;
      }

      const newEvent: TimelineEvent = {
        id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        complaintId: complaint.id,
        status: newStatus,
        message: message || `Status updated to ${newStatus.replace('_', ' ').toUpperCase()} in bulk.`,
        updatedBy: currentUser?.name || 'Administrator',
        role: currentUser?.role || 'admin',
        timestamp,
        isInternal: false,
      };

      const isResolved = newStatus === 'resolved';

      const updatedItem: Complaint = {
        ...complaint,
        status: newStatus,
        updatedAt: timestamp,
        resolvedAt: isResolved ? timestamp : (newStatus === 'in_progress' || newStatus === 'pending' || newStatus === 'assigned') ? undefined : complaint.resolvedAt,
        timeline: [...complaint.timeline, newEvent],
      };

      updatedComplaints.push(updatedItem);

      if (notifyStudent) {
        try {
          notificationService.createNotification({
            userId: complaint.studentId,
            title: isResolved ? 'Complaint Resolved' : 'Status Updated',
            message: `Ticket ${complaint.ticketNumber} status is now ${newStatus.replace('_', ' ').toUpperCase()}: "${message || 'Bulk update by administration.'}"`,
            type: isResolved ? 'success' : newStatus === 'rejected' ? 'error' : 'info',
            category: isResolved ? 'complaint_resolved' : 'status_changed',
            complaintId: complaint.id,
            link: `/student/complaints/${complaint.id}`,
          });
        } catch (e) {
          console.warn('Could not dispatch bulk notification:', e);
        }
      }

      return updatedItem;
    });

    setStorageItem(STORAGE_KEYS.COMPLAINTS, updatedList);
    return updatedComplaints;
  }

  public async getAdminStats(): Promise<AdminKPIStats> {
    this.ensureInitialized();
    const complaints = getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS);

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    let pending = 0;
    let inProgress = 0;
    let resolved = 0;
    let critical = 0;
    let newComplaints = 0;

    const statusBreakdown: Record<ComplaintStatus, number> = {
      pending: 0,
      assigned: 0,
      in_progress: 0,
      resolved: 0,
      rejected: 0,
    };

    const categoryBreakdown: Record<string, number> = {};
    const priorityBreakdown: Record<Priority, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    // Build map of last 7 calendar days
    const dailyMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split('T')[0];
      dailyMap.set(key, 0);
    }

    complaints.forEach((c) => {
      if (statusBreakdown[c.status] !== undefined) {
        statusBreakdown[c.status]++;
      }
      if (c.status === 'pending') pending++;
      if (c.status === 'in_progress' || c.status === 'assigned') inProgress++;
      if (c.status === 'resolved') resolved++;

      if (priorityBreakdown[c.priority] !== undefined) {
        priorityBreakdown[c.priority]++;
      }
      if (c.priority === 'critical') {
        critical++;
      }

      const cat = c.category || 'other';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;

      const createdTime = new Date(c.createdAt).getTime();
      if (createdTime >= sevenDaysAgo || c.status === 'pending') {
        newComplaints++;
      }

      const dateKey = c.createdAt.split('T')[0];
      if (dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + 1);
      }
    });

    const dailyTrends = Array.from(dailyMap.entries()).map(([dateStr, count]) => {
      const d = new Date(dateStr);
      const label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
      return { date: dateStr, label, count };
    });

    return {
      total: complaints.length,
      newComplaints,
      pending,
      inProgress,
      resolved,
      critical,
      statusBreakdown,
      categoryBreakdown,
      priorityBreakdown,
      dailyTrends,
    };
  }

  public async getAllRecentActivity(limit: number = 10): Promise<AdminActivityEvent[]> {
    this.ensureInitialized();
    const complaints = getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS);
    const events: AdminActivityEvent[] = [];

    complaints.forEach((complaint) => {
      if (Array.isArray(complaint.timeline)) {
        complaint.timeline.forEach((tl) => {
          events.push({
            ...tl,
            ticketNumber: complaint.ticketNumber,
            complaintTitle: complaint.title,
          });
        });
      }
    });

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return events.slice(0, limit);
  }

  public async addComment(
    complaintId: string,
    message: string,
    isInternal: boolean = false
  ): Promise<Complaint> {
    this.ensureInitialized();
    const complaints = getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS);
    const currentUser = authService.getCurrentUser();
    const index = complaints.findIndex(
      (c) => c.id === complaintId || c.ticketNumber === complaintId
    );

    if (index === -1) {
      throw new Error(`Complaint with ID ${complaintId} not found`);
    }

    const complaint = complaints[index];
    const timestamp = new Date().toISOString();
    const commentId = `comment-${Date.now()}`;

    const newComment: ComplaintComment = {
      id: commentId,
      complaintId: complaint.id,
      authorId: currentUser?.id || 'anonymous',
      authorName: currentUser?.name || 'User',
      authorRole: currentUser?.role || 'student',
      message: message.trim(),
      timestamp,
      isInternal,
    };

    const newTimelineEvent: TimelineEvent = {
      id: `tl-${Date.now()}`,
      complaintId: complaint.id,
      status: complaint.status,
      message: `${currentUser?.name || 'User'}: ${message.trim()}`,
      updatedBy: currentUser?.name || 'User',
      role: currentUser?.role || 'student',
      timestamp,
      isInternal,
    };

    const updated: Complaint = {
      ...complaint,
      updatedAt: timestamp,
      comments: [...(complaint.comments || []), newComment],
      timeline: [...complaint.timeline, newTimelineEvent],
    };

    complaints[index] = updated;
    setStorageItem(STORAGE_KEYS.COMPLAINTS, complaints);

    // If student commented, notify admin
    if (currentUser?.role === 'student') {
      try {
        await notificationService.createNotification({
          userId: 'user-admin-1',
          title: 'New Student Comment',
          message: `${currentUser.name} added a comment on ${complaint.ticketNumber}: "${message.slice(0, 60)}..."`,
          type: 'info',
          link: `/admin/complaints/${complaint.id}`,
        });
      } catch (e) {
        console.warn('Could not dispatch comment notification:', e);
      }
    } else if ((currentUser?.role === 'admin' || currentUser?.role === 'staff') && !isInternal) {
      // If admin/staff posted a public comment, notify student
      try {
        await notificationService.createNotification({
          userId: complaint.studentId,
          title: 'Administrative Update',
          message: `${currentUser?.name || 'Administrator'} posted an update on ${complaint.ticketNumber}: "${message.slice(0, 60)}..."`,
          type: 'info',
          category: 'admin_message',
          complaintId: complaint.id,
          link: `/student/complaints/${complaint.id}`,
        });
      } catch (e) {
        console.warn('Could not dispatch admin comment notification:', e);
      }
    }

    return updated;
  }

  public async reopenComplaint(
    complaintId: string,
    reason: string
  ): Promise<Complaint> {
    this.ensureInitialized();
    const complaints = getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS);
    const currentUser = authService.getCurrentUser();
    const index = complaints.findIndex(
      (c) => c.id === complaintId || c.ticketNumber === complaintId
    );

    if (index === -1) {
      throw new Error(`Complaint with ID ${complaintId} not found`);
    }

    const complaint = complaints[index];
    if (complaint.status !== 'resolved' && complaint.status !== 'rejected') {
      throw new Error('Only resolved or rejected complaints can be reopened');
    }

    const timestamp = new Date().toISOString();
    const reopenEvent: TimelineEvent = {
      id: `tl-${Date.now()}`,
      complaintId: complaint.id,
      status: 'pending',
      message: `Complaint reopened by student. Reason: ${reason.trim()}`,
      updatedBy: currentUser?.name || 'Student',
      role: 'student',
      timestamp,
    };

    const updated: Complaint = {
      ...complaint,
      status: 'pending',
      reopenReason: reason.trim(),
      reopenedAt: timestamp,
      updatedAt: timestamp,
      timeline: [...complaint.timeline, reopenEvent],
    };

    complaints[index] = updated;
    setStorageItem(STORAGE_KEYS.COMPLAINTS, complaints);

    // Notify admin
    try {
      await notificationService.createNotification({
        userId: 'user-admin-1',
        title: 'Complaint Reopened',
        message: `${complaint.ticketNumber} was reopened by ${currentUser?.name || 'Student'}: "${reason.trim()}"`,
        type: 'warning',
        link: `/admin/complaints/${complaint.id}`,
      });
    } catch (e) {
      console.warn('Could not dispatch reopen notification:', e);
    }

    return updated;
  }

  public async rateSatisfaction(
    complaintId: string,
    rating: 'satisfied' | 'not_satisfied',
    feedback?: string
  ): Promise<Complaint> {
    this.ensureInitialized();
    const complaints = getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS);
    const currentUser = authService.getCurrentUser();
    const index = complaints.findIndex(
      (c) => c.id === complaintId || c.ticketNumber === complaintId
    );

    if (index === -1) {
      throw new Error(`Complaint with ID ${complaintId} not found`);
    }

    const complaint = complaints[index];
    if (complaint.status !== 'resolved') {
      throw new Error('Satisfaction rating is only available for resolved complaints');
    }

    const timestamp = new Date().toISOString();
    const ratingEvent: TimelineEvent = {
      id: `tl-${Date.now()}`,
      complaintId: complaint.id,
      status: 'resolved',
      message: `Student recorded feedback: ${
        rating === 'satisfied' ? 'Satisfied 😊' : 'Not Satisfied 🙁'
      }${feedback ? ` - "${feedback.trim()}"` : ''}`,
      updatedBy: currentUser?.name || 'Student',
      role: 'student',
      timestamp,
    };

    const updated: Complaint = {
      ...complaint,
      satisfaction: {
        rating,
        feedback: feedback?.trim() || undefined,
        submittedAt: timestamp,
      },
      updatedAt: timestamp,
      timeline: [...complaint.timeline, ratingEvent],
    };

    complaints[index] = updated;
    setStorageItem(STORAGE_KEYS.COMPLAINTS, complaints);
    return updated;
  }
}

export const complaintService = new ComplaintService();
