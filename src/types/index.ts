/**
 * Smart College Complaint Portal - Core Type Definitions
 */

export type Role = 'student' | 'admin' | 'staff';

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  emailAlerts?: boolean;
  statusChangeAlerts?: boolean;
  assignmentAlerts?: boolean;
  digestSummary?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  studentId?: string;
  department?: string;
  designation?: string;
  year?: string;
  phone?: string;
  bio?: string;
  avatarUrl?: string;
  preferences?: UserPreferences;
  password?: string; // Stored securely in mock database
  status?: 'active' | 'inactive';
  createdAt: string;
}

export type SafeUser = Omit<User, 'password'>;

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: 'staff';
  department: string;
  designation: string;
  phone?: string;
  avatarUrl?: string;
}

export interface RegisterData {
  name: string;
  studentId: string;
  email: string;
  department: string;
  year: string;
  phone: string;
  password: string;
  confirmPassword?: string;
  termsAccepted: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
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
  isInternal?: boolean;
}

export interface SatisfactionFeedback {
  rating: 'satisfied' | 'not_satisfied';
  feedback?: string;
  submittedAt: string;
}

export interface ComplaintComment {
  id: string;
  complaintId: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  message: string;
  timestamp: string;
  isInternal?: boolean;
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
  building?: string;
  floor?: string;
  roomNumber?: string;
  location?: string;
  additionalDetails?: string;
  attachments?: string[];
  assignedTo?: string;
  assignedStaffName?: string;
  assignedDepartment?: string;
  estimatedResolutionDate?: string;
  resolvedAt?: string;
  satisfaction?: SatisfactionFeedback;
  comments?: ComplaintComment[];
  reopenReason?: string;
  reopenedAt?: string;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineEvent[];
}

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export type NotificationCategory =
  | 'complaint_submitted'
  | 'complaint_assigned'
  | 'status_changed'
  | 'complaint_resolved'
  | 'admin_message'
  | 'system_notification';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  category?: NotificationCategory | string;
  complaintId?: string;
  broadcastId?: string;
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
  pushNotifications: boolean;
  studentNotifications: boolean;
  maintenanceMode: boolean;
  autoAssignComplaints: boolean;
  defaultPriority: Priority;
  allowReopening: boolean;
  allowAnonymousComplaints: boolean;
  maxAttachmentsPerComplaint: number;
  maxAttachmentSizeMB: number;
  supportEmail: string;
  supportPhone: string;
}

export interface BroadcastNotification {
  id: string;
  title: string;
  message: string;
  audience: 'all_students' | 'department' | 'student';
  targetDepartment?: string;
  targetStudentId?: string;
  targetStudentName?: string;
  priority: 'info' | 'warning' | 'error';
  sentBy: string;
  sentAt: string;
  recipientCount: number;
  status?: 'delivered' | 'failed';
  failureReason?: string;
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

export type DateRangeOption = '7d' | '30d' | '3m' | '6m' | '1y';

export interface TrendDataPoint {
  label: string;
  startDate: string;
  endDate: string;
  submitted: number;
  resolved: number;
}

export interface CategoryMetric {
  category: string;
  label: string;
  count: number;
  percentage: number;
}

export interface PriorityMetric {
  priority: Priority | 'unknown';
  label: string;
  count: number;
  percentage: number;
}

export interface StatusMetric {
  status: ComplaintStatus;
  label: string;
  count: number;
  percentage: number;
}

export interface DepartmentMetric {
  department: string;
  total: number;
  resolved: number;
  pending: number;
  active: number;
  resolutionRate: number;
}

export interface ComprehensiveAnalytics {
  range: DateRangeOption;
  periodLabel: string;
  startDate: string;
  endDate: string;
  totalComplaints: number;
  pendingComplaints: number;
  assignedComplaints: number;
  inProgressComplaints: number;
  resolvedComplaints: number;
  rejectedComplaints: number;
  activeQueue: number;
  resolutionRate: number;
  avgResolutionTimeHours: number | null;
  avgResolutionTimeFormatted: string;
  trendData: TrendDataPoint[];
  categoryDistribution: CategoryMetric[];
  priorityDistribution: PriorityMetric[];
  statusDistribution: StatusMetric[];
  departmentPerformance: DepartmentMetric[];
}

export interface FilterOptions {
  status?: ComplaintStatus | 'all';
  priority?: Priority | 'all';
  category?: string | 'all';
  searchQuery?: string;
  sortBy?: 'createdAt' | 'priority' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface StudentComplaintStats {
  total: number;
  pending: number;
  assigned: number;
  inProgress: number;
  resolved: number;
  rejected: number;
  byStatus: Record<ComplaintStatus, number>;
}

export interface StudentActivityEvent extends TimelineEvent {
  ticketNumber: string;
  complaintTitle: string;
}

export interface AdminKPIStats {
  total: number;
  newComplaints: number;
  pending: number;
  inProgress: number;
  resolved: number;
  critical: number;
  statusBreakdown: Record<ComplaintStatus, number>;
  categoryBreakdown: Record<string, number>;
  priorityBreakdown: Record<Priority, number>;
  dailyTrends: { date: string; label: string; count: number }[];
}

export interface AdminActivityEvent extends TimelineEvent {
  ticketNumber: string;
  complaintTitle: string;
}

