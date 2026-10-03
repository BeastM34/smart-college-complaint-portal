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
  User,
} from '@/types';
import { STORAGE_KEYS, getStorageItem, setStorageItem } from '@/utils/storage';
import { MOCK_COMPLAINTS, MOCK_USERS } from '@/data/mockData';
import { authService } from './authService';
import { notificationService } from './notificationService';
import { settingsService } from './settingsService';

export type CanonicalDepartment =
  | 'it'
  | 'electrical'
  | 'plumbing'
  | 'housekeeping'
  | 'maintenance'
  | 'security';

/**
 * Normalizes text for category and department matching by:
 * - Converting to lower case
 * - Replacing '&' with 'and'
 * - Replacing hyphens, underscores and non-alphanumeric chars with spaces
 * - Trimming and collapsing multiple whitespace chars
 */
export const normalizeCategoryToken = (str?: string): string => {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Explicit mapping from category identifiers/aliases to canonical department.
 */
export const resolveCategoryToCanonicalDepartment = (
  category?: string
): CanonicalDepartment | null => {
  const norm = normalizeCategoryToken(category);
  if (!norm) return null;

  const tokens = norm.split(' ');

  // 1. IT: matches 'it', 'wifi', 'wi fi', 'internet', 'network', 'information technology'
  if (
    tokens.includes('it') ||
    tokens.includes('wifi') ||
    norm.includes('wi fi') ||
    tokens.includes('internet') ||
    tokens.includes('network') ||
    norm.includes('information technology') ||
    norm.includes('academic facilities and labs') ||
    norm.includes('academic facilities labs') ||
    tokens.includes('academic') ||
    tokens.includes('computers') ||
    tokens.includes('computer')
  ) {
    return 'it';
  }

  // 2. Electrical: matches 'electrical', 'electric', 'electricity', 'power', 'lighting'
  if (
    tokens.includes('electrical') ||
    tokens.includes('electric') ||
    tokens.includes('electricity') ||
    tokens.includes('power') ||
    tokens.includes('lighting') ||
    norm.includes('cat 2')
  ) {
    return 'electrical';
  }

  // 3. Plumbing: matches 'plumbing', 'plumb', 'plumber', 'water'
  if (
    tokens.includes('plumbing') ||
    tokens.includes('plumb') ||
    tokens.includes('plumber') ||
    tokens.includes('water') ||
    tokens.includes('drainage') ||
    tokens.includes('leakage')
  ) {
    return 'plumbing';
  }

  // 4. Housekeeping & Sanitation: matches 'housekeeping', 'sanitation', 'cleaning', 'clean', 'hygiene', 'janitorial', 'waste'
  if (
    tokens.includes('housekeeping') ||
    tokens.includes('sanitation') ||
    tokens.includes('cleaning') ||
    tokens.includes('clean') ||
    tokens.includes('hygiene') ||
    tokens.includes('janitorial') ||
    tokens.includes('waste') ||
    norm.includes('cat 4')
  ) {
    return 'housekeeping';
  }

  // 5. Maintenance & Infrastructure: matches 'maintenance', 'infrastructure', 'furniture', 'civil', 'hostel'
  if (
    tokens.includes('maintenance') ||
    tokens.includes('infrastructure') ||
    tokens.includes('furniture') ||
    tokens.includes('civil') ||
    tokens.includes('hostel') ||
    norm.includes('cat 1') ||
    norm.includes('cat 3')
  ) {
    return 'maintenance';
  }

  // 6. Security: matches 'security', 'safety'
  if (tokens.includes('security') || tokens.includes('safety')) {
    return 'security';
  }

  return null;
};

/**
 * Explicit mapping from staff member department to canonical department.
 * CRITICAL: Standalone token checks ensure unrelated departments like "facilities" NEVER match "it".
 */
export const resolveStaffDepartmentToCanonical = (
  department?: string
): CanonicalDepartment | null => {
  const norm = normalizeCategoryToken(department);
  if (!norm) return null;

  const tokens = norm.split(' ');

  // 1. IT: matches standalone 'it' token, 'network', 'information technology', 'it support', 'it services'
  // Notice: 'facilities' has tokens ['facilities'], so tokens.includes('it') is FALSE!
  if (
    tokens.includes('it') ||
    tokens.includes('network') ||
    norm.includes('information technology')
  ) {
    return 'it';
  }

  // 2. Electrical
  if (
    tokens.includes('electrical') ||
    tokens.includes('electric') ||
    tokens.includes('electrician')
  ) {
    return 'electrical';
  }

  // 3. Plumbing
  if (
    tokens.includes('plumbing') ||
    tokens.includes('plumber')
  ) {
    return 'plumbing';
  }

  // 4. Housekeeping & Sanitation
  if (
    tokens.includes('housekeeping') ||
    tokens.includes('sanitation') ||
    tokens.includes('cleaning')
  ) {
    return 'housekeeping';
  }

  // 5. Maintenance & Infrastructure (including Facilities)
  if (
    tokens.includes('maintenance') ||
    tokens.includes('infrastructure') ||
    tokens.includes('facilities') ||
    tokens.includes('civil') ||
    tokens.includes('estate')
  ) {
    return 'maintenance';
  }

  // 6. Security
  if (tokens.includes('security') || tokens.includes('safety')) {
    return 'security';
  }

  return null;
};

/**
 * Checks whether a complaint category matches a staff member's department without false substring matches.
 */
export const isCategoryDepartmentMatch = (
  category?: string,
  staffDepartment?: string
): boolean => {
  if (!category || !staffDepartment) return false;

  const normCat = normalizeCategoryToken(category);
  const normDept = normalizeCategoryToken(staffDepartment);

  // Exact normalized equality match
  if (normCat === normDept && normCat.length > 0) return true;

  // Canonical resolution
  const catCanon = resolveCategoryToCanonicalDepartment(category);
  const deptCanon = resolveStaffDepartmentToCanonical(staffDepartment);

  if (catCanon && deptCanon && catCanon === deptCanon) {
    return true;
  }

  return false;
};

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

/**
 * Validates an individual attachment payload submitted with a complaint.
 * Enforces:
 * 1. Must be a valid string starting with "data:".
 * 2. Must be a properly formatted Data URL with MIME type and ";base64" separator.
 * 3. Must be one of the supported image formats: JPEG/JPG, PNG, WebP.
 * 4. Must contain non-empty, valid Base64 data.
 * 5. Decoded binary byte size (accounting for padding) must not exceed maxAttachmentSizeMB.
 */
export function validateAttachmentPayload(
  att: unknown,
  index: number,
  maxSizeMB: number
): void {
  const position = index + 1;

  if (typeof att !== 'string' || !att.trim()) {
    throw new Error(
      `Invalid attachment at position ${position}: Attachment must be a valid non-empty data URL string.`
    );
  }

  const trimmed = att.trim();
  if (!trimmed.startsWith('data:')) {
    throw new Error(
      `Malformed attachment at position ${position}: Attachment must be a valid Data URL starting with "data:".`
    );
  }

  const commaIndex = trimmed.indexOf(',');
  if (commaIndex === -1) {
    throw new Error(
      `Malformed attachment at position ${position}: Data URL is missing the base64 content separator.`
    );
  }

  const header = trimmed.slice(0, commaIndex);
  const base64Data = trimmed.slice(commaIndex + 1);

  // Parse header: data:<mime-type>[;charset=...];base64
  const headerMatch = header.match(/^data:([^;]+)(?:;[^;]+)*;base64$/i);
  if (!headerMatch) {
    throw new Error(
      `Malformed attachment at position ${position}: Data URL must declare a valid MIME type and ";base64" encoding.`
    );
  }

  const mimeType = headerMatch[1].toLowerCase().trim();
  if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(mimeType)) {
    throw new Error(
      `Unsupported attachment format "${mimeType}" at position ${position}. Only JPEG, PNG, and WebP images are allowed.`
    );
  }

  if (!base64Data || base64Data.trim().length === 0) {
    throw new Error(
      `Malformed attachment at position ${position}: Base64 data payload is empty.`
    );
  }

  const cleanBase64 = base64Data.replace(/[\r\n\s]+/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleanBase64) || cleanBase64.length % 4 !== 0) {
    throw new Error(
      `Malformed attachment at position ${position}: Invalid Base64 data encoding.`
    );
  }

  // Calculate decoded byte size accounting for Base64 padding
  let padding = 0;
  if (cleanBase64.endsWith('==')) {
    padding = 2;
  } else if (cleanBase64.endsWith('=')) {
    padding = 1;
  }

  const decodedBytes = Math.floor((cleanBase64.length * 3) / 4) - padding;
  if (decodedBytes <= 0) {
    throw new Error(
      `Malformed attachment at position ${position}: Attachment payload contains zero decoded bytes.`
    );
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (decodedBytes > maxSizeBytes) {
    const actualMB = (decodedBytes / (1024 * 1024)).toFixed(2);
    throw new Error(
      `Attachment exceeds the maximum allowed file size of ${maxSizeMB}MB (actual size: ${actualMB}MB).`
    );
  }
}

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
    const settings = settingsService.getSettingsSync();

    // 1. Maintenance Mode Enforcement
    if (settings.maintenanceMode && currentUser?.role !== 'admin') {
      throw new Error('Complaint submissions are temporarily disabled due to scheduled system maintenance.');
    }

    // 2. Attachments Count Enforcement
    const maxAttachments = settings.maxAttachmentsPerComplaint ?? 3;
    if (data.attachments !== undefined) {
      if (!Array.isArray(data.attachments)) {
        throw new Error('Attachments must be provided as an array of data URLs.');
      }
      if (data.attachments.length > maxAttachments) {
        throw new Error(
          `Maximum ${maxAttachments} attachments allowed per complaint. Received ${data.attachments.length}.`
        );
      }

      // 3. Attachments Validation (Format, Encoding, and Size)
      const maxSizeMB = settings.maxAttachmentSizeMB ?? 5;
      for (let i = 0; i < data.attachments.length; i++) {
        validateAttachmentPayload(data.attachments[i], i, maxSizeMB);
      }
    }

    // 4. Default Priority Resolution
    const finalPriority: Priority = data.priority || settings.defaultPriority || 'medium';

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

    // 5. Automatic Complaint Assignment Resolution
    let initialStatus: ComplaintStatus = 'pending';
    let assignedTo: string | undefined = undefined;
    let assignedStaffName: string | undefined = undefined;
    let assignedDepartment: string | undefined = undefined;
    let initialTimelineMessage = 'Complaint submitted by student.';

    if (settings.autoAssignComplaints) {
      const users = getStorageItem<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
      // Only select active personnel whose role is staff with a valid id
      const activeStaff = users.filter(
        (u) => u.role === 'staff' && (u.status || 'active') === 'active' && !!u.id
      );

      const handler = activeStaff.find((p) => isCategoryDepartmentMatch(data.category, p.department));

      if (handler) {
        assignedTo = handler.id;
        assignedStaffName = handler.name;
        assignedDepartment = handler.department;
        initialStatus = 'assigned';
        initialTimelineMessage = `Complaint submitted by student and automatically assigned to ${handler.name} (${handler.department || 'Staff'}).`;
      } else {
        // Leave unassigned and in pending status when no matching personnel is available
        assignedTo = undefined;
        assignedStaffName = undefined;
        assignedDepartment = undefined;
        initialStatus = 'pending';
        initialTimelineMessage = 'Complaint submitted by student (unassigned: no matching active department personnel available).';
      }
    }

    const initialTimeline: TimelineEvent = {
      id: `tl-${Date.now()}`,
      complaintId: id,
      status: initialStatus,
      message: initialTimelineMessage,
      updatedBy: currentUser?.name || data.studentName || 'Student',
      role: 'student',
      timestamp,
    };

    const newComplaint: Complaint = {
      ...data,
      id,
      ticketNumber,
      priority: finalPriority,
      status: initialStatus,
      assignedTo,
      assignedStaffName,
      assignedDepartment,
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
    const settings = settingsService.getSettingsSync();
    if (!settings.allowReopening) {
      throw new Error('Complaint reopening is currently disabled by institutional policy.');
    }

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
