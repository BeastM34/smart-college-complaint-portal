import type {
  Complaint,
  ComplaintStatus,
  FilterOptions,
  TimelineEvent,
  StudentComplaintStats,
  StudentActivityEvent,
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

  public async getComplaintById(id: string): Promise<Complaint | null> {
    this.ensureInitialized();
    const complaints = getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS);
    return complaints.find((c) => c.id === id || c.ticketNumber === id) || null;
  }

  public async getStudentComplaints(studentIdOrEmail: string): Promise<Complaint[]> {
    this.ensureInitialized();
    const complaints = getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS);
    return complaints.filter(
      (c) => c.studentId === studentIdOrEmail || c.studentEmail === studentIdOrEmail
    );
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
    message: string
  ): Promise<Complaint> {
    this.ensureInitialized();
    const complaints = getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS);
    const currentUser = authService.getCurrentUser();
    const index = complaints.findIndex((c) => c.id === id);

    if (index === -1) {
      throw new Error(`Complaint with ID ${id} not found`);
    }

    const timestamp = new Date().toISOString();
    const complaint = complaints[index];

    const newEvent: TimelineEvent = {
      id: `tl-${Date.now()}`,
      complaintId: id,
      status,
      message,
      updatedBy: currentUser?.name || 'Administrator',
      role: currentUser?.role || 'admin',
      timestamp,
    };

    const updated: Complaint = {
      ...complaint,
      status,
      updatedAt: timestamp,
      resolvedAt: status === 'resolved' ? timestamp : complaint.resolvedAt,
      timeline: [...complaint.timeline, newEvent],
    };

    complaints[index] = updated;
    setStorageItem(STORAGE_KEYS.COMPLAINTS, complaints);
    return updated;
  }

  public async assignComplaint(
    id: string,
    staffId: string,
    staffName: string
  ): Promise<Complaint> {
    this.ensureInitialized();
    const complaints = getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS);
    const currentUser = authService.getCurrentUser();
    const index = complaints.findIndex((c) => c.id === id);

    if (index === -1) {
      throw new Error(`Complaint with ID ${id} not found`);
    }

    const timestamp = new Date().toISOString();
    const complaint = complaints[index];

    const newEvent: TimelineEvent = {
      id: `tl-${Date.now()}`,
      complaintId: id,
      status: 'assigned',
      message: `Assigned to ${staffName}.`,
      updatedBy: currentUser?.name || 'Administrator',
      role: currentUser?.role || 'admin',
      timestamp,
    };

    const updated: Complaint = {
      ...complaint,
      status: 'assigned',
      assignedTo: staffId,
      assignedStaffName: staffName,
      updatedAt: timestamp,
      timeline: [...complaint.timeline, newEvent],
    };

    complaints[index] = updated;
    setStorageItem(STORAGE_KEYS.COMPLAINTS, complaints);
    return updated;
  }
}

export const complaintService = new ComplaintService();
