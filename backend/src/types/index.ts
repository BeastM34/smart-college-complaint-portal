/**
 * Smart College Complaint Portal - Backend Core Types
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface HealthCheckResponse {
  success: boolean;
  message: string;
  environment: string;
  timestamp: string;
  version: string;
  database?: {
    configured: boolean;
    connected: boolean;
    status: 'connected' | 'not_configured' | 'error';
    message: string;
  };
}

export interface ComplaintAttachment {
  id: string;
  complaint_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
  signed_url?: string;
}

export interface AttachmentUploadResult {
  storagePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export type UserRole = 'student' | 'staff' | 'admin';
export type UserStatus = 'active' | 'inactive';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  student_id?: string | null;
  department?: string | null;
  designation?: string | null;
  year?: string | null;
  phone?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  preferences?: Record<string, unknown>;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
}

export interface AuthResponseData {
  user: {
    id: string;
    email?: string;
    [key: string]: unknown;
  };
  profile: UserProfile | null;
  session?: AuthSession | null;
}

export type ComplaintPriority = 'low' | 'medium' | 'high' | 'critical';
export type ComplaintStatus = 'pending' | 'assigned' | 'in_progress' | 'resolved' | 'rejected';

export interface Complaint {
  id: string;
  ticket_number: string;
  title: string;
  description: string;
  category_id: string;
  category_slug?: string | null;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  student_id: string;
  department?: string | null;
  building?: string | null;
  floor?: string | null;
  room_number?: string | null;
  location?: string | null;
  additional_details?: string | null;
  assigned_to?: string | null;
  assigned_department?: string | null;
  estimated_resolution_date?: string | null;
  resolved_at?: string | null;
  satisfaction_rating?: 'satisfied' | 'not_satisfied' | null;
  satisfaction_feedback?: string | null;
  satisfaction_submitted_at?: string | null;
  reopen_reason?: string | null;
  reopened_at?: string | null;
  created_at: string;
  updated_at: string;
  student_name?: string | null;
  student_email?: string | null;
  student_college_id?: string | null;
  student_profile?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    student_id?: string | null;
    department?: string | null;
  } | null;
  assigned_staff_name?: string | null;
  assigned_profile?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    department?: string | null;
  } | null;
}

export interface CreateComplaintInput {
  title: string;
  description: string;
  category: string;
  priority?: ComplaintPriority;
  department?: string;
  building?: string;
  floor?: string;
  roomNumber?: string;
  room_number?: string;
  location?: string;
  additionalDetails?: string;
  additional_details?: string;
}

export interface ComplaintFilterQuery {
  status?: string;
  priority?: string;
  category?: string;
  page?: number | string;
  limit?: number | string;
}

export interface ComplaintComment {
  id: string;
  complaint_id: string;
  author_id: string;
  message: string;
  is_internal: boolean;
  created_at: string;
}

export interface ComplaintTimelineEvent {
  id: string;
  complaint_id: string;
  status: ComplaintStatus;
  action: string;
  message: string;
  updated_by: string;
  is_internal: boolean;
  created_at: string;
}

export interface AssignComplaintInput {
  assigned_to: string;
  assigned_department?: string;
  notes?: string;
}

export interface UpdateComplaintStatusInput {
  status: ComplaintStatus;
  notes?: string;
  resolution_notes?: string;
  estimated_resolution_date?: string;
}

export interface ReopenComplaintInput {
  reason: string;
}

export interface CreateCommentInput {
  message: string;
  is_internal?: boolean;
}

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  category?: string | null;
  complaint_id?: string | null;
  broadcast_id?: string | null;
  read: boolean;
  link?: string | null;
  created_at: string;
}

export interface NotificationFilterQuery {
  read?: string | boolean;
  type?: string;
  page?: number | string;
  limit?: number | string;
}

export interface CreateNotificationInput {
  user_id: string;
  title: string;
  message: string;
  type?: NotificationType;
  category?: string;
  complaint_id?: string;
  broadcast_id?: string;
  link?: string;
}

export interface BroadcastNotification {
  id: string;
  title: string;
  message: string;
  audience: 'all_students' | 'department' | 'student';
  target_department?: string | null;
  target_student_id?: string | null;
  priority: 'info' | 'warning' | 'error';
  sent_by: string;
  recipient_count: number;
  status: 'delivered' | 'failed';
  sent_at: string;
}

export interface CreateBroadcastInput {
  title: string;
  message: string;
  audience?: 'all_students' | 'department' | 'student';
  targetDepartment?: string;
  target_department?: string;
  targetStudentId?: string;
  target_student_id?: string;
  priority?: 'info' | 'warning' | 'error';
}

// =============================================================================
// Phase 4D: Categories, Settings, Analytics & Users Types
// =============================================================================

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  sla_hours: number;
  active: boolean;
  complaint_count?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCategoryInput {
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  sla_hours?: number;
  active?: boolean;
}

export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  description?: string;
  icon?: string;
  sla_hours?: number;
  active?: boolean;
}

export interface SystemSettings {
  id: number;
  portal_name: string;
  academic_year: string;
  allow_student_registration: boolean;
  email_notifications: boolean;
  sms_notifications: boolean;
  push_notifications: boolean;
  student_notifications: boolean;
  maintenance_mode: boolean;
  auto_assign_complaints: boolean;
  default_priority: ComplaintPriority;
  allow_reopening: boolean;
  allow_anonymous_complaints: boolean;
  max_attachments_per_complaint: number;
  max_attachment_size_mb: number;
  support_email: string;
  support_phone: string;
  created_at?: string;
  updated_at?: string;
}

export type UpdateSystemSettingsInput = Partial<
  Omit<SystemSettings, 'id' | 'created_at' | 'updated_at'>
>;

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
  priority: ComplaintPriority | 'unknown';
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

export interface AnalyticsFilterQuery {
  range?: DateRangeOption | string;
  startDate?: string;
  endDate?: string;
  category?: string;
  priority?: string;
  status?: string;
  department?: string;
}

export interface SafeUserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  student_id?: string | null;
  department?: string | null;
  designation?: string | null;
  year?: string | null;
  phone?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface UserFilterQuery {
  role?: string;
  status?: string;
  department?: string;
  search?: string;
  page?: number | string;
  limit?: number | string;
}

declare global {
  namespace Express {
    interface Request {
      token?: string;
      user?: {
        id: string;
        email?: string;
        [key: string]: unknown;
      };
      profile?: UserProfile;
      supabase?: import('@supabase/supabase-js').SupabaseClient;
    }
  }
}


