import type {
  Complaint,
  ComplaintStatus,
  FilterOptions,
  TimelineEvent,
} from '@/types';
import { STORAGE_KEYS, getStorageItem, setStorageItem } from '@/utils/storage';
import { MOCK_COMPLAINTS } from '@/data/mockData';
import { authService } from './authService';

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

  public async getStudentComplaints(studentId: string): Promise<Complaint[]> {
    this.ensureInitialized();
    const complaints = getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS);
    return complaints.filter((c) => c.studentId === studentId);
  }

  public async createComplaint(
    data: Omit<Complaint, 'id' | 'ticketNumber' | 'createdAt' | 'updatedAt' | 'timeline'>
  ): Promise<Complaint> {
    this.ensureInitialized();
    const complaints = getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS);
    const currentUser = authService.getCurrentUser();

    const timestamp = new Date().toISOString();
    const nextIndex = complaints.length + 1;
    const ticketNumber = `CMP-2026-${String(nextIndex).padStart(3, '0')}`;
    const id = `cmp-${Date.now()}`;

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
