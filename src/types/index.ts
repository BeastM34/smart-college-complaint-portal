/**
 * Smart College Complaint Portal - Core Type Definitions
 */

export type Role = 'student' | 'admin' | 'staff';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  studentId?: string;
  department?: string;
  phone?: string;
  avatarUrl?: string;
  createdAt: string;
}

export type ComplaintStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'rejected';

export type Priority = 'low' | 'medium' | 'high' | 'critical';

export type ComplaintCategory =
  | 'hostel'
  | 'academic'
  | 'infrastructure'
  | 'canteen'
  | 'transport'
  | 'library'
  | 'electrical'
  | 'sanitation'
  | 'other'
  | string;

export interface TimelineEvent {
  id: string;
  complaintId: string;
  status: ComplaintStatus;
  message: string;
  updatedBy: string;
  role: Role;
  timestamp: string;
}

export interface Complaint {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  priority: Priority;
  status: ComplaintStatus;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  department?: string;
  location?: string;
  roomNumber?: string;
  attachments?: string[];
  assignedTo?: string;
  assignedStaffName?: string;
  estimatedResolutionDate?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineEvent[];
}

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  link?: string;
  createdAt: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon?: string;
  active: boolean;
  complaintCount?: number;
  slaHours?: number;
}

export interface SystemSettings {
  portalName: string;
  academicYear: string;
  allowStudentRegistration: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  maintenanceMode: boolean;
  autoAssignComplaints: boolean;
  maxAttachmentsPerComplaint: number;
  maxAttachmentSizeMB: number;
  supportEmail: string;
  supportPhone: string;
}

export interface AnalyticsSummary {
  totalComplaints: number;
  pendingComplaints: number;
  assignedComplaints: number;
  inProgressComplaints: number;
  resolvedComplaints: number;
  rejectedComplaints: number;
  avgResolutionTimeHours: number;
  complaintsByCategory: Record<string, number>;
  complaintsByPriority: Record<Priority, number>;
  monthlyTrends: {
    month: string;
    submitted: number;
    resolved: number;
  }[];
}

export interface FilterOptions {
  status?: ComplaintStatus | 'all';
  priority?: Priority | 'all';
  category?: string | 'all';
  searchQuery?: string;
  sortBy?: 'createdAt' | 'priority' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
