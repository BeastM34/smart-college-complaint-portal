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
import {
  STORAGE_KEYS,
  getStorageItem,
  setStorageItem,
  StorageQuotaError,
  isQuotaExceededError,
} from '@/utils/storage';
import { MOCK_COMPLAINTS, MOCK_USERS } from '@/data/mockData';
import { authService } from './authService';
import { notificationService } from './notificationService';
import { settingsService } from './settingsService';
import { apiClient } from './apiClient';

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
 * Controlled, explicit mappings from normalized category names, slugs, and controlled aliases
 * to their responsible canonical department.
 *
 * Source of truth: MOCK_CATEGORIES & CategoryService:
 * - 'electrical' / 'Electrical & Power' -> electrical
 * - 'sanitation' / 'Sanitation & Hygiene' -> housekeeping
 * - 'infrastructure' / 'Campus Infrastructure' -> maintenance
 * - 'wifi' / 'network' / 'internet' / 'it' -> it
 * - 'plumbing' -> plumbing
 *
 * Categories without a clear single responsible department (academic, library,
 * canteen, transport, hostel) deliberately return null and remain unassigned.
 */
const EXPLICIT_CATEGORY_TO_DEPT_MAP: Record<string, CanonicalDepartment> = {
  // IT & Networking
  'it': 'it',
  'it support': 'it',
  'information technology': 'it',
  'wifi': 'it',
  'wi fi': 'it',
  'wi fi network': 'it',
  'wifi network': 'it',
  'network': 'it',
  'network support': 'it',
  'internet': 'it',

  // Electrical & Power
  'electrical': 'electrical',
  'electrical and power': 'electrical',
  'electrical power': 'electrical',
  'electrical maintenance': 'electrical',
  'electricity': 'electrical',
  'cat 2': 'electrical',

  // Plumbing & Water Supply
  'plumbing': 'plumbing',
  'plumbing and water supply': 'plumbing',
  'plumbing water supply': 'plumbing',
  'water supply': 'plumbing',

  // Sanitation & Housekeeping
  'sanitation': 'housekeeping',
  'sanitation and hygiene': 'housekeeping',
  'sanitation hygiene': 'housekeeping',
  'housekeeping': 'housekeeping',
  'cleaning': 'housekeeping',
  'cat 4': 'housekeeping',

  // Maintenance & Infrastructure
  'infrastructure': 'maintenance',
  'campus infrastructure': 'maintenance',
  'maintenance': 'maintenance',
  'cat 3': 'maintenance',
};

/**
 * Resolves a complaint category to a canonical department using strict, explicit mappings.
 * Returns null for unmapped categories so they remain pending and unassigned.
 */
export const resolveCategoryToCanonicalDepartment = (
  category?: string
): CanonicalDepartment | null => {
  const norm = normalizeCategoryToken(category);
  if (!norm) return null;

  // Direct lookup against explicit category names, slugs, and controlled aliases
  if (norm in EXPLICIT_CATEGORY_TO_DEPT_MAP) {
    return EXPLICIT_CATEGORY_TO_DEPT_MAP[norm];
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
 * Maps a backend complaint comment object to frontend ComplaintComment model.
 */
export function mapBackendComment(cm: any): ComplaintComment {
  return {
    id: cm.id,
    complaintId: cm.complaint_id || cm.complaintId,
    authorId: cm.author_id || cm.authorId || cm.user_id || 'unknown',
    authorName: cm.author_name || cm.authorName || cm.user_name || 'User',
    authorRole: cm.author_role || cm.authorRole || cm.user_role || 'student',
    message: cm.message || '',
    timestamp: cm.created_at || cm.timestamp || new Date().toISOString(),
    isInternal: cm.is_internal ?? cm.isInternal ?? false,
  };
}

/**
 * Maps a backend complaint timeline event object to frontend TimelineEvent model.
 */
export function mapBackendTimelineEvent(t: any): TimelineEvent {
  return {
    id: t.id,
    complaintId: t.complaint_id || t.complaintId,
    status: t.status || 'pending',
    message: t.message || '',
    updatedBy: t.updated_by_name || t.updated_by || t.updatedBy || 'System',
    role: t.updated_by_role || t.role || 'student',
    timestamp: t.created_at || t.timestamp || new Date().toISOString(),
    isInternal: t.is_internal ?? t.isInternal ?? false,
  };
}

/**
 * Maps a backend complaint object to frontend Complaint model.
 */
export function mapBackendComplaint(c: any): Complaint {
  return {
    id: c.id,
    ticketNumber: c.ticket_number || c.ticketNumber,
    title: c.title,
    description: c.description,
    category: c.category_slug || c.category || 'other',
    priority: c.priority,
    status: c.status,
    studentId: c.student_profile?.student_id || c.student_college_id || c.student_id || c.studentId,
    studentCollegeId: c.student_profile?.student_id || c.student_college_id || undefined,
    studentName: c.student_profile?.name || c.student_name || c.studentName || 'Student',
    studentEmail: c.student_profile?.email || c.student_email || c.studentEmail || undefined,
    department: c.department || c.student_profile?.department || undefined,
    building: c.building || undefined,
    floor: c.floor || undefined,
    roomNumber: c.room_number || c.roomNumber || undefined,
    location: c.location || undefined,
    additionalDetails: c.additional_details || c.additionalDetails || undefined,
    attachments: c.attachments || [],
    assignedTo: c.assigned_to || c.assignedTo || undefined,
    assignedStaffName: c.assigned_profile?.name || c.assigned_staff_name || c.assignedStaffName || undefined,
    assignedDepartment: c.assigned_department || c.assignedDepartment || undefined,
    estimatedResolutionDate: c.estimated_resolution_date || c.estimatedResolutionDate || undefined,
    resolvedAt: c.resolved_at || c.resolvedAt || undefined,
    satisfaction: c.satisfaction_rating
      ? {
          rating: c.satisfaction_rating,
          feedback: c.satisfaction_feedback || undefined,
          submittedAt: c.satisfaction_submitted_at || '',
        }
      : c.satisfaction,
    comments: Array.isArray(c.comments)
      ? c.comments.map(mapBackendComment)
      : c.comments,
    timeline: Array.isArray(c.timeline)
      ? c.timeline.map(mapBackendTimelineEvent)
      : c.timeline || [],
    reopenReason: c.reopen_reason || c.reopenReason || undefined,
    reopenedAt: c.reopened_at || c.reopenedAt || undefined,
    createdAt: c.created_at || c.createdAt,
    updatedAt: c.updated_at || c.updatedAt,
  };
}

/**
 * Complaint Service
 * Manages fetching, filtering, creating, and updating complaint data.
 */
class ComplaintService {
  /**
   * Enforces strict uniqueness of complaint records by stable complaint ID.
   * Preserves original insertion ordering while eliminating duplicate records.
   */
  public deduplicateComplaints(list: Complaint[]): Complaint[] {
    if (!Array.isArray(list)) return [];
    const seen = new Set<string>();
    const result: Complaint[] = [];
    for (const c of list) {
      if (!c || typeof c !== 'object') continue;
      const idKey = (c.id || '').trim().toLowerCase();
      if (!idKey || seen.has(idKey)) continue;
      seen.add(idKey);
      result.push(c);
    }
    return result;
  }

  public ensureInitialized(): void {
    const existing = getStorageItem<Complaint[] | null>(STORAGE_KEYS.COMPLAINTS, null);
    if (!existing || !Array.isArray(existing) || existing.length === 0) {
      setStorageItem(STORAGE_KEYS.COMPLAINTS, this.deduplicateComplaints(MOCK_COMPLAINTS));
      return;
    }
    const deduplicated = this.deduplicateComplaints(existing);
    if (deduplicated.length !== existing.length) {
      setStorageItem(STORAGE_KEYS.COMPLAINTS, deduplicated);
    }
  }

  public async getComplaints(filter?: FilterOptions): Promise<Complaint[]> {
    // Attempt real backend API first
    try {
      const params = new URLSearchParams();
      if (filter?.status && filter.status !== 'all') params.set('status', filter.status);
      if (filter?.priority && filter.priority !== 'all') params.set('priority', filter.priority);
      if (filter?.category && filter.category !== 'all') params.set('category', filter.category);
      const queryStr = params.toString() ? `?${params.toString()}` : '';

      const res = await apiClient.get<any[]>(`/complaints${queryStr}`);
      if (res && res.success && Array.isArray(res.data)) {
        return res.data.map(mapBackendComplaint);
      }
    } catch (err: any) {
      if (err?.status === 401 || err?.status === 403) {
        if (!authService.isAuthenticated()) throw err;
      }
      // Offline fallback for unit tests
    }

    this.ensureInitialized();
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are permitted to retrieve all complaints.');
    }

    let complaints = this.deduplicateComplaints(
      getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS)
    );

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
    try {
      let res;
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        res = await apiClient.get(`/complaints/${encodeURIComponent(id)}`);
      } else {
        res = await apiClient.get(`/complaints/ticket/${encodeURIComponent(id)}`);
      }
      if (res && res.success && res.data) {
        const mapped = mapBackendComplaint(res.data);
        try {
          const [commentsRes, timelineRes] = await Promise.allSettled([
            apiClient.get<any[]>(`/complaints/${encodeURIComponent(mapped.id)}/comments`),
            apiClient.get<any[]>(`/complaints/${encodeURIComponent(mapped.id)}/timeline`),
          ]);
          if (commentsRes.status === 'fulfilled' && commentsRes.value?.success && Array.isArray(commentsRes.value.data)) {
            mapped.comments = commentsRes.value.data.map(mapBackendComment);
          }
          if (timelineRes.status === 'fulfilled' && timelineRes.value?.success && Array.isArray(timelineRes.value.data)) {
            mapped.timeline = timelineRes.value.data.map(mapBackendTimelineEvent);
          }
        } catch {
          // non-blocking secondary hydration
        }
        if (filterInternal) {
          mapped.comments = mapped.comments?.filter((c) => !c.isInternal);
          mapped.timeline = mapped.timeline?.filter((t) => !t.isInternal);
        }
        return mapped;
      }
    } catch (err: any) {
      if (err?.status === 404) {
        return null;
      }
      if (err?.status === 401 || err?.status === 403) {
        if (!authService.isAuthenticated()) throw err;
      }
      // Offline fallback
    }

    this.ensureInitialized();
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('Unauthorized: An authenticated session is required to view complaint details.');
    }

    const complaints = this.deduplicateComplaints(
      getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS)
    );
    const item = complaints.find((c) => c.id === id || c.ticketNumber === id) || null;
    if (!item) return null;

    // Admin has access to all complaints; filterInternal specifies if internal notes are stripped
    if (currentUser.role === 'admin') {
      if (filterInternal) {
        return {
          ...item,
          timeline: item.timeline.filter((t) => !t.isInternal),
          comments: item.comments?.filter((c) => !c.isInternal),
        };
      }
      return item;
    }

    // Student can only access their own complaints
    if (currentUser.role === 'student') {
      const isOwner =
        item.studentId === currentUser.id ||
        (item.studentEmail && currentUser.email && item.studentEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
        (currentUser.studentId && item.studentId.toLowerCase() === currentUser.studentId.toLowerCase());

      if (!isOwner) {
        throw new Error('Unauthorized: You do not have permission to view this complaint.');
      }

      // Internal admin notes are strictly confidential (students cannot view them)
      return {
        ...item,
        timeline: item.timeline.filter((t) => !t.isInternal),
        comments: item.comments?.filter((c) => !c.isInternal),
      };
    }

    // Staff can only access complaints assigned to them
    if (currentUser.role === 'staff') {
      const isAssigned = item.assignedTo === currentUser.id;

      if (!isAssigned) {
        throw new Error('Unauthorized: You do not have permission to view this complaint.');
      }

      // Internal admin notes are strictly confidential (staff cannot view them)
      return {
        ...item,
        timeline: item.timeline.filter((t) => !t.isInternal),
        comments: item.comments?.filter((c) => !c.isInternal),
      };
    }

    throw new Error('Unauthorized: Invalid account role.');
  }

  public async getStudentComplaints(studentIdOrEmail: string): Promise<Complaint[]> {
    try {
      const res = await apiClient.get<any[]>('/complaints');
      if (res && res.success && Array.isArray(res.data)) {
        return res.data.map(mapBackendComplaint);
      }
    } catch (err: any) {
      if (err?.status === 401 || err?.status === 403) {
        if (!authService.isAuthenticated()) throw err;
      }
      // Offline fallback
    }

    this.ensureInitialized();
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('Unauthorized: An authenticated session is required to retrieve student complaints.');
    }

    if (currentUser.role === 'student') {
      const isSelf =
        studentIdOrEmail === currentUser.id ||
        (currentUser.email && studentIdOrEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
        (currentUser.studentId && studentIdOrEmail.toLowerCase() === currentUser.studentId.toLowerCase());

      if (!isSelf) {
        throw new Error('Unauthorized: You can only retrieve complaints for your own account.');
      }

      const complaints = this.deduplicateComplaints(
        getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS)
      );
      return complaints
        .filter(
          (c) =>
            c.studentId === currentUser.id ||
            Boolean(c.studentEmail && currentUser.email && c.studentEmail.toLowerCase() === currentUser.email.toLowerCase())
        )
        .map((c) => ({
          ...c,
          timeline: c.timeline.filter((t) => !t.isInternal),
          comments: c.comments?.filter((cm) => !cm.isInternal),
        }));
    }

    if (currentUser.role === 'admin') {
      const complaints = this.deduplicateComplaints(
        getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS)
      );
      return complaints.filter(
        (c) =>
          c.studentId === studentIdOrEmail ||
          Boolean(c.studentEmail && c.studentEmail.toLowerCase() === studentIdOrEmail.toLowerCase())
      );
    }

    throw new Error('Unauthorized: Staff members cannot query arbitrary student complaints.');
  }

  public async getStaffComplaints(staffIdOrEmail: string): Promise<Complaint[]> {
    try {
      const res = await apiClient.get<any[]>('/complaints');
      if (res && res.success && Array.isArray(res.data)) {
        return res.data.map(mapBackendComplaint);
      }
    } catch (err: any) {
      if (err?.status === 401 || err?.status === 403) {
        if (!authService.isAuthenticated()) throw err;
      }
      // Offline fallback
    }

    this.ensureInitialized();
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('Unauthorized: An authenticated session is required to retrieve staff complaints.');
    }

    if (currentUser.role === 'staff') {
      const isSelf =
        staffIdOrEmail === currentUser.id ||
        Boolean(currentUser.email && staffIdOrEmail.toLowerCase() === currentUser.email.toLowerCase());

      if (!isSelf) {
        throw new Error('Unauthorized: You can only retrieve complaints assigned to your own account.');
      }

      const complaints = this.deduplicateComplaints(
        getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS)
      );
      return complaints
        .filter((c) => c.assignedTo === currentUser.id)
        .map((c) => ({
          ...c,
          timeline: c.timeline.filter((t) => !t.isInternal),
          comments: c.comments?.filter((cm) => !cm.isInternal),
        }));
    }

    if (currentUser.role === 'admin') {
      const complaints = this.deduplicateComplaints(
        getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS)
      );
      return complaints.filter(
        (c) =>
          c.assignedTo === staffIdOrEmail ||
          (c.assignedStaffName && c.assignedStaffName.toLowerCase() === staffIdOrEmail.toLowerCase())
      );
    }

    throw new Error('Unauthorized: Students are not permitted to query staff complaints.');
  }

  public async getStudentStats(studentIdOrEmail: string): Promise<StudentComplaintStats> {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('Unauthorized: An authenticated session is required to retrieve student statistics.');
    }
    if (currentUser.role === 'student') {
      const isSelf =
        studentIdOrEmail === currentUser.id ||
        studentIdOrEmail.toLowerCase() === currentUser.email.toLowerCase() ||
        (currentUser.studentId && studentIdOrEmail.toLowerCase() === currentUser.studentId.toLowerCase());

      if (!isSelf) {
        throw new Error('Unauthorized: You can only view statistics for your own account.');
      }
    } else if (currentUser.role === 'staff') {
      throw new Error('Unauthorized: Staff members cannot view student statistics.');
    }

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
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('Unauthorized: An authenticated session is required to retrieve student activity.');
    }
    if (currentUser.role === 'student') {
      const isSelf =
        studentIdOrEmail === currentUser.id ||
        studentIdOrEmail.toLowerCase() === currentUser.email.toLowerCase() ||
        (currentUser.studentId && studentIdOrEmail.toLowerCase() === currentUser.studentId.toLowerCase());

      if (!isSelf) {
        throw new Error('Unauthorized: You can only view activity for your own account.');
      }
    } else if (currentUser.role === 'staff') {
      throw new Error('Unauthorized: Staff members cannot view student activity.');
    }

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
    // 1. Attempt real backend API first if authenticated session exists
    try {
      const payload: Record<string, any> = {
        title: (data.title || '').trim(),
        description: (data.description || '').trim(),
        category: (data.category || '').trim(),
      };
      if (data.priority) payload.priority = data.priority;
      if (data.department) payload.department = data.department;
      if (data.building) payload.building = data.building;
      if (data.floor) payload.floor = data.floor;
      if (data.roomNumber) payload.roomNumber = data.roomNumber;
      if (data.location) payload.location = data.location;
      if (data.additionalDetails) payload.additionalDetails = data.additionalDetails;

      const res = await apiClient.post('/complaints', payload);
      if (res && res.success && res.data) {
        return mapBackendComplaint(res.data);
      }
    } catch (err: any) {
      if (err?.status === 400 || err?.status === 401 || err?.status === 403) {
        throw new Error(err.message || 'Failed to submit complaint.');
      }
      // Offline fallback for unit tests running without backend server
    }

    this.ensureInitialized();
    const complaints = this.deduplicateComplaints(
      getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS)
    );
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
    const existingIds = new Set<string>();
    const existingTickets = new Set<string>();

    complaints.forEach((c) => {
      if (c.id) existingIds.add(c.id.toLowerCase());
      if (c.ticketNumber) existingTickets.add(c.ticketNumber.toLowerCase());

      const match = c.ticketNumber?.match(/CMP-(?:2026-)?0*(\d+)/i) || c.id?.match(/cmp-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    });

    let nextSeq = maxSeq + 1;
    // Guaranteed non-collision loop: ensures next sequence never collides with any existing ID or ticket
    while (
      existingIds.has(`cmp-${nextSeq}`.toLowerCase()) ||
      existingTickets.has(`cmp-${nextSeq}`.toLowerCase())
    ) {
      nextSeq++;
    }

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

    const updatedList = this.deduplicateComplaints([newComplaint, ...complaints]);

    // Attempt persistence. If storage write fails, abort immediately without reporting false-success.
    let writeSuccess = false;
    try {
      writeSuccess = setStorageItem(STORAGE_KEYS.COMPLAINTS, updatedList);
    } catch (err: unknown) {
      if (isQuotaExceededError(err)) {
        throw new StorageQuotaError(
          'Unable to save your complaint because browser storage is full. Please remove some stored demo data or reset Demo Mode and try again.',
          err
        );
      }
      throw err;
    }

    if (!writeSuccess) {
      throw new StorageQuotaError(
        'Unable to save your complaint because browser storage is full. Please remove some stored demo data or reset Demo Mode and try again.'
      );
    }

    // Create admin notification only after primary complaint persistence is verified
    try {
      await notificationService.createNotification({
        userId: 'user-admin-1',
        title: 'New Complaint Submitted',
        message: `${ticketNumber}: ${newComplaint.title} (${newComplaint.category} - ${newComplaint.priority.toUpperCase()} priority)`,
        type: newComplaint.priority === 'critical' ? 'warning' : 'info',
        link: `/admin/complaints/${id}`,
      });
    } catch (e) {
      console.warn('Could not dispatch admin notification (complaint safely created):', e);
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
    try {
      let complaintUuid = id;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        const resolved = await this.getComplaintById(id);
        if (resolved?.id) {
          complaintUuid = resolved.id;
        }
      }

      const payload: Record<string, any> = {
        status,
        notes: message,
      };
      if (status === 'resolved') {
        payload.resolution_notes = message;
      }

      const res = await apiClient.patch<any>(`/complaints/${encodeURIComponent(complaintUuid)}/status`, payload);
      if (res && res.success && res.data) {
        const fresh = await this.getComplaintById(complaintUuid, !isInternal);
        return fresh || mapBackendComplaint(res.data);
      }
    } catch (err: any) {
      if (err?.status === 400 || err?.status === 401 || err?.status === 403 || err?.status === 404) {
        throw new Error(err.message || 'Failed to update complaint status.');
      }
      // Offline fallback
    }

    this.ensureInitialized();
    const complaints = this.deduplicateComplaints(
      getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS)
    );
    const currentUser = authService.getCurrentUser();
    const index = complaints.findIndex((c) => c.id === id || c.ticketNumber === id);

    if (index === -1) {
      throw new Error(`Complaint with ID ${id} not found`);
    }

    if (!currentUser) {
      throw new Error('Unauthorized: An authenticated session is required to update complaint status.');
    }

    const complaint = complaints[index];

    // Students cannot update complaint status directly
    if (currentUser.role === 'student') {
      throw new Error(
        'Unauthorized: Students are not permitted to directly modify complaint statuses. Use reopenComplaint if eligible.'
      );
    }

    // Staff can only update complaints assigned to them and cannot create internal notes
    if (currentUser.role === 'staff') {
      if (complaint.assignedTo !== currentUser.id) {
        throw new Error(
          'Unauthorized: Staff members can only update complaints assigned directly to them.'
        );
      }
      if (isInternal) {
        throw new Error(
          'Unauthorized: Only administrators are permitted to create internal status updates.'
        );
      }
    }

    const timestamp = new Date().toISOString();

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
    const writeOk = setStorageItem(STORAGE_KEYS.COMPLAINTS, this.deduplicateComplaints(complaints));
    if (!writeOk) {
      throw new StorageQuotaError('Unable to update complaint because browser storage is full.');
    }

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

  public async resolveComplaint(
    id: string,
    notes?: string,
    resolutionNotes?: string
  ): Promise<Complaint> {
    try {
      let complaintUuid = id;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        const resolved = await this.getComplaintById(id);
        if (resolved?.id) {
          complaintUuid = resolved.id;
        }
      }

      const payload: Record<string, any> = {
        notes,
        resolution_notes: resolutionNotes || notes,
      };

      const res = await apiClient.patch<any>(`/complaints/${encodeURIComponent(complaintUuid)}/resolution`, payload);
      if (res && res.success && res.data) {
        const fresh = await this.getComplaintById(complaintUuid);
        return fresh || mapBackendComplaint(res.data);
      }
    } catch (err: any) {
      if (err?.status === 400 || err?.status === 401 || err?.status === 403 || err?.status === 404) {
        throw new Error(err.message || 'Failed to resolve complaint.');
      }
    }

    return this.updateComplaintStatus(id, 'resolved', resolutionNotes || notes || 'Complaint resolved');
  }

  public async assignComplaint(
    id: string,
    staffId: string,
    staffName?: string,
    department?: string,
    notifyStudent: boolean = true
  ): Promise<Complaint> {
    try {
      let complaintUuid = id;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        const resolved = await this.getComplaintById(id);
        if (resolved?.id) {
          complaintUuid = resolved.id;
        }
      }

      const payload: Record<string, any> = {
        assigned_to: staffId,
      };
      if (department) payload.assigned_department = department;

      const res = await apiClient.patch<any>(`/complaints/${encodeURIComponent(complaintUuid)}/assignment`, payload);
      if (res && res.success && res.data) {
        const fresh = await this.getComplaintById(complaintUuid, false);
        return fresh || mapBackendComplaint(res.data);
      }
    } catch (err: any) {
      if (err?.status === 400 || err?.status === 401 || err?.status === 403 || err?.status === 404) {
        throw new Error(err.message || 'Failed to assign complaint.');
      }
      // Offline fallback
    }

    this.ensureInitialized();
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are permitted to assign complaints.');
    }

    const complaints = this.deduplicateComplaints(
      getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS)
    );
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
    const writeOk = setStorageItem(STORAGE_KEYS.COMPLAINTS, this.deduplicateComplaints(complaints));
    if (!writeOk) {
      throw new StorageQuotaError('Unable to assign complaint because browser storage is full.');
    }

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
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are permitted to update complaint priorities.');
    }

    const complaints = this.deduplicateComplaints(
      getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS)
    );
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
    const writeOk = setStorageItem(STORAGE_KEYS.COMPLAINTS, this.deduplicateComplaints(complaints));
    if (!writeOk) {
      throw new StorageQuotaError('Unable to update complaint priority because browser storage is full.');
    }

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
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are permitted to perform bulk status updates.');
    }

    const complaints = this.deduplicateComplaints(
      getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS)
    );
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

    const writeOk = setStorageItem(STORAGE_KEYS.COMPLAINTS, this.deduplicateComplaints(updatedList));
    if (!writeOk) {
      throw new StorageQuotaError('Unable to perform bulk update because browser storage is full.');
    }
    return updatedComplaints;
  }

  public async getAdminStats(): Promise<AdminKPIStats> {
    const currentUser = authService.getCurrentUser();
    if (currentUser && currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are permitted to retrieve admin statistics.');
    }

    try {
      const res = await apiClient.get<any>('/analytics?range=7d');
      if (res && res.success && res.data) {
        const full = res.data;
        const statusBreakdown: Record<ComplaintStatus, number> = {
          pending: full.pendingComplaints || 0,
          assigned: full.assignedComplaints || 0,
          in_progress: full.inProgressComplaints || 0,
          resolved: full.resolvedComplaints || 0,
          rejected: full.rejectedComplaints || 0,
        };
        const categoryBreakdown: Record<string, number> = {};
        (full.categoryDistribution || []).forEach((c: any) => {
          categoryBreakdown[c.category] = c.count;
        });
        const priorityBreakdown: Record<Priority, number> = {
          low: 0,
          medium: 0,
          high: 0,
          critical: 0,
        };
        (full.priorityDistribution || []).forEach((p: any) => {
          if (p.priority in priorityBreakdown) {
            priorityBreakdown[p.priority as Priority] = p.count;
          }
        });
        const dailyTrends = (full.trendData || []).map((t: any) => ({
          date: t.startDate,
          label: t.label,
          count: t.submitted,
        }));

        return {
          total: full.totalComplaints || 0,
          newComplaints: (full.pendingComplaints || 0) + (full.assignedComplaints || 0),
          pending: full.pendingComplaints || 0,
          inProgress: full.inProgressComplaints || 0,
          resolved: full.resolvedComplaints || 0,
          critical: priorityBreakdown.critical,
          statusBreakdown,
          categoryBreakdown,
          priorityBreakdown,
          dailyTrends,
        };
      }
    } catch (err: any) {
      if (err?.status === 401 || err?.status === 403) {
        throw new Error(err.message || 'Unauthorized: Only administrators are permitted to retrieve admin statistics.');
      }
      // Offline fallback
    }

    this.ensureInitialized();
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are permitted to retrieve admin statistics.');
    }

    const complaints = this.deduplicateComplaints(
      getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS)
    );

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
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are permitted to retrieve all recent activity.');
    }

    const complaints = this.deduplicateComplaints(
      getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS)
    );
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
    try {
      let complaintUuid = complaintId;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(complaintId)) {
        const resolved = await this.getComplaintById(complaintId);
        if (resolved?.id) {
          complaintUuid = resolved.id;
        }
      }

      const payload = {
        message: message.trim(),
        is_internal: Boolean(isInternal),
      };

      const res = await apiClient.post<any>(`/complaints/${encodeURIComponent(complaintUuid)}/comments`, payload);
      if (res && res.success) {
        const fresh = await this.getComplaintById(complaintUuid, !isInternal);
        if (fresh) return fresh;
      }
    } catch (err: any) {
      if (err?.status === 400 || err?.status === 401 || err?.status === 403 || err?.status === 404) {
        throw new Error(err.message || 'Failed to add comment.');
      }
      // Offline fallback
    }

    this.ensureInitialized();
    const complaints = this.deduplicateComplaints(
      getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS)
    );
    const currentUser = authService.getCurrentUser();
    const index = complaints.findIndex(
      (c) => c.id === complaintId || c.ticketNumber === complaintId
    );

    if (index === -1) {
      throw new Error(`Complaint with ID ${complaintId} not found`);
    }

    if (!currentUser) {
      throw new Error('Unauthorized: An authenticated session is required to add comments.');
    }

    // Confidentiality rule: Only administrators are permitted to create internal notes
    if (isInternal && currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are permitted to create internal notes.');
    }

    const complaint = complaints[index];

    // Students can only comment on their own complaints
    if (
      currentUser.role === 'student' &&
      complaint.studentId !== currentUser.id &&
      complaint.studentEmail !== currentUser.email
    ) {
      throw new Error('Unauthorized: Students can only comment on their own complaints.');
    }

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
    const writeOk = setStorageItem(STORAGE_KEYS.COMPLAINTS, this.deduplicateComplaints(complaints));
    if (!writeOk) {
      throw new StorageQuotaError('Unable to add comment because browser storage is full.');
    }

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
    try {
      let complaintUuid = complaintId;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(complaintId)) {
        const resolved = await this.getComplaintById(complaintId);
        if (resolved?.id) {
          complaintUuid = resolved.id;
        }
      }

      const payload = {
        reason: reason.trim(),
      };

      const res = await apiClient.post<any>(`/complaints/${encodeURIComponent(complaintUuid)}/reopen`, payload);
      if (res && res.success && res.data) {
        const fresh = await this.getComplaintById(complaintUuid);
        return fresh || mapBackendComplaint(res.data);
      }
    } catch (err: any) {
      if (err?.status === 400 || err?.status === 401 || err?.status === 403 || err?.status === 404) {
        throw new Error(err.message || 'Failed to reopen complaint.');
      }
      // Offline fallback
    }

    this.ensureInitialized();
    const settings = settingsService.getSettingsSync();
    if (!settings.allowReopening) {
      throw new Error('Complaint reopening is currently disabled by institutional policy.');
    }

    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('Unauthorized: An authenticated session is required to reopen complaints.');
    }

    if (currentUser.role === 'staff') {
      throw new Error('Unauthorized: Staff members cannot reopen complaints.');
    }

    const complaints = this.deduplicateComplaints(
      getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS)
    );
    const index = complaints.findIndex(
      (c) => c.id === complaintId || c.ticketNumber === complaintId
    );

    if (index === -1) {
      throw new Error(`Complaint with ID ${complaintId} not found`);
    }

    const complaint = complaints[index];

    // Students can only reopen their own complaints
    if (currentUser.role === 'student') {
      const isOwner =
        complaint.studentId === currentUser.id ||
        (complaint.studentEmail && currentUser.email && complaint.studentEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
        (currentUser.studentId && complaint.studentId.toLowerCase() === currentUser.studentId.toLowerCase());
      if (!isOwner) {
        throw new Error('Unauthorized: Students can only reopen their own complaints.');
      }
    }

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
    const writeOk = setStorageItem(STORAGE_KEYS.COMPLAINTS, this.deduplicateComplaints(complaints));
    if (!writeOk) {
      throw new StorageQuotaError('Unable to reopen complaint because browser storage is full.');
    }

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
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('Unauthorized: An authenticated session is required to rate satisfaction.');
    }

    const complaints = this.deduplicateComplaints(
      getStorageItem<Complaint[]>(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS)
    );
    const index = complaints.findIndex(
      (c) => c.id === complaintId || c.ticketNumber === complaintId
    );

    if (index === -1) {
      throw new Error(`Complaint with ID ${complaintId} not found`);
    }

    const complaint = complaints[index];

    // Ownership check: student must own the complaint, or admin
    if (currentUser.role === 'student') {
      const isOwner =
        complaint.studentId === currentUser.id ||
        (complaint.studentEmail && currentUser.email && complaint.studentEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
        (currentUser.studentId && complaint.studentId.toLowerCase() === currentUser.studentId.toLowerCase());
      if (!isOwner) {
        throw new Error('Unauthorized: You can only rate satisfaction for your own complaints.');
      }
    } else if (currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only the complaint owner or administrator can submit satisfaction feedback.');
    }

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
    const writeOk = setStorageItem(STORAGE_KEYS.COMPLAINTS, this.deduplicateComplaints(complaints));
    if (!writeOk) {
      throw new StorageQuotaError('Unable to rate complaint because browser storage is full.');
    }
    return updated;
  }

  public async postComment(
    complaintId: string,
    message: string,
    isInternal: boolean = false
  ): Promise<ComplaintComment> {
    try {
      let complaintUuid = complaintId;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(complaintId)) {
        const resolved = await this.getComplaintById(complaintId);
        if (resolved?.id) {
          complaintUuid = resolved.id;
        }
      }

      const payload = {
        message: message.trim(),
        is_internal: Boolean(isInternal),
      };

      const res = await apiClient.post<any>(`/complaints/${encodeURIComponent(complaintUuid)}/comments`, payload);
      if (res && res.success && res.data) {
        return mapBackendComment(res.data);
      }
    } catch (err: any) {
      if (err?.status === 400 || err?.status === 401 || err?.status === 403 || err?.status === 404) {
        throw new Error(err.message || 'Failed to post comment.');
      }
    }

    const complaint = await this.addComment(complaintId, message, isInternal);
    return (complaint.comments?.[complaint.comments.length - 1] || {
      id: `comment-${Date.now()}`,
      complaintId,
      authorId: authService.getCurrentUser()?.id || 'anonymous',
      authorName: authService.getCurrentUser()?.name || 'User',
      authorRole: authService.getCurrentUser()?.role || 'student',
      message: message.trim(),
      timestamp: new Date().toISOString(),
      isInternal,
    }) as ComplaintComment;
  }

  public async getComments(complaintId: string): Promise<ComplaintComment[]> {
    try {
      let complaintUuid = complaintId;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(complaintId)) {
        const resolved = await this.getComplaintById(complaintId);
        if (resolved?.id) {
          complaintUuid = resolved.id;
        }
      }

      const res = await apiClient.get<any[]>(`/complaints/${encodeURIComponent(complaintUuid)}/comments`);
      if (res && res.success && Array.isArray(res.data)) {
        return res.data.map(mapBackendComment);
      }
    } catch (err: any) {
      if (err?.status === 401 || err?.status === 403 || err?.status === 404) {
        if (!authService.isAuthenticated()) throw err;
      }
    }

    const complaint = await this.getComplaintById(complaintId);
    return complaint?.comments || [];
  }

  public async getTimeline(complaintId: string): Promise<TimelineEvent[]> {
    try {
      let complaintUuid = complaintId;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(complaintId)) {
        const resolved = await this.getComplaintById(complaintId);
        if (resolved?.id) {
          complaintUuid = resolved.id;
        }
      }

      const res = await apiClient.get<any[]>(`/complaints/${encodeURIComponent(complaintUuid)}/timeline`);
      if (res && res.success && Array.isArray(res.data)) {
        return res.data.map(mapBackendTimelineEvent);
      }
    } catch (err: any) {
      if (err?.status === 401 || err?.status === 403 || err?.status === 404) {
        if (!authService.isAuthenticated()) throw err;
      }
    }

    const complaint = await this.getComplaintById(complaintId);
    return complaint?.timeline || [];
  }
}

export const complaintService = new ComplaintService();
