import type { SystemSettings, Priority, User } from '@/types';
import { STORAGE_KEYS, getStorageItem, setStorageItem } from '@/utils/storage';
import {
  MOCK_SETTINGS,
  MOCK_COMPLAINTS,
  MOCK_USERS,
  MOCK_NOTIFICATIONS,
  MOCK_CATEGORIES,
  MOCK_BROADCASTS,
} from '@/data/mockData';
import { apiClient } from './apiClient';
import { authService } from './authService';

const VALID_PRIORITIES: Priority[] = ['low', 'medium', 'high', 'critical'];

/**
 * Maps backend snake_case SystemSettings to frontend camelCase SystemSettings.
 */
export function mapBackendSettings(b: any): SystemSettings {
  return {
    portalName: b.portal_name ?? b.portalName ?? 'Smart College Complaint Portal',
    academicYear: b.academic_year ?? b.academicYear ?? '2026-2027',
    allowStudentRegistration: b.allow_student_registration ?? b.allowStudentRegistration ?? true,
    emailNotifications: b.email_notifications ?? b.emailNotifications ?? true,
    smsNotifications: b.sms_notifications ?? b.smsNotifications ?? false,
    pushNotifications: b.push_notifications ?? b.pushNotifications ?? true,
    studentNotifications: b.student_notifications ?? b.studentNotifications ?? true,
    maintenanceMode: b.maintenance_mode ?? b.maintenanceMode ?? false,
    autoAssignComplaints: b.auto_assign_complaints ?? b.autoAssignComplaints ?? true,
    defaultPriority: b.default_priority ?? b.defaultPriority ?? 'medium',
    allowReopening: b.allow_reopening ?? b.allowReopening ?? true,
    allowAnonymousComplaints: b.allow_anonymous_complaints ?? b.allowAnonymousComplaints ?? false,
    maxAttachmentsPerComplaint: b.max_attachments_per_complaint ?? b.maxAttachmentsPerComplaint ?? 3,
    maxAttachmentSizeMB: b.max_attachment_size_mb ?? b.maxAttachmentSizeMB ?? 5,
    supportEmail: b.support_email ?? b.supportEmail ?? 'support@college.edu',
    supportPhone: b.support_phone ?? b.supportPhone ?? '+1 (555) 019-2834',
  };
}

/**
 * Maps frontend camelCase SystemSettings to backend snake_case partial payload.
 */
export function toBackendSettings(s: Partial<SystemSettings>): Record<string, any> {
  const b: Record<string, any> = {};
  if (s.portalName !== undefined) b.portal_name = s.portalName;
  if (s.academicYear !== undefined) b.academic_year = s.academicYear;
  if (s.allowStudentRegistration !== undefined) b.allow_student_registration = s.allowStudentRegistration;
  if (s.emailNotifications !== undefined) b.email_notifications = s.emailNotifications;
  if (s.smsNotifications !== undefined) b.sms_notifications = s.smsNotifications;
  if (s.pushNotifications !== undefined) b.push_notifications = s.pushNotifications;
  if (s.studentNotifications !== undefined) b.student_notifications = s.studentNotifications;
  if (s.maintenanceMode !== undefined) b.maintenance_mode = s.maintenanceMode;
  if (s.autoAssignComplaints !== undefined) b.auto_assign_complaints = s.autoAssignComplaints;
  if (s.defaultPriority !== undefined) b.default_priority = s.defaultPriority;
  if (s.allowReopening !== undefined) b.allow_reopening = s.allowReopening;
  if (s.allowAnonymousComplaints !== undefined) b.allow_anonymous_complaints = s.allowAnonymousComplaints;
  if (s.maxAttachmentsPerComplaint !== undefined) b.max_attachments_per_complaint = s.maxAttachmentsPerComplaint;
  if (s.maxAttachmentSizeMB !== undefined) b.max_attachment_size_mb = s.maxAttachmentSizeMB;
  if (s.supportEmail !== undefined) b.support_email = s.supportEmail;
  if (s.supportPhone !== undefined) b.support_phone = s.supportPhone;
  return b;
}

/**
 * Settings Service
 * Manages institutional portal settings, administrative preferences, and demo data reset.
 */
class SettingsService {
  private ensureInitialized(): void {
    const existing = getStorageItem<unknown>(STORAGE_KEYS.SETTINGS, null);
    if (!existing || typeof existing !== 'object') {
      setStorageItem(STORAGE_KEYS.SETTINGS, MOCK_SETTINGS);
    }
  }

  /**
   * Verifies that the current active session belongs to a valid, active administrator in USERS storage.
   * Throws descriptive unauthorized errors if session is missing, deleted, inactive, or non-admin.
   */
  public assertAdminSession(): User {
    const sessionUser = getStorageItem<User | null>(STORAGE_KEYS.SESSION, null);
    if (!sessionUser || !sessionUser.id) {
      throw new Error('Unauthorized: No active session found. Please sign in as an administrator.');
    }

    const users = getStorageItem<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
    const liveUser = users.find((u) => u.id === sessionUser.id);
    if (!liveUser) {
      throw new Error('Unauthorized: Administrator account could not be found or has been deleted.');
    }

    if ((liveUser.status || 'active') === 'inactive') {
      throw new Error('Unauthorized: Administrator account is currently inactive.');
    }

    if (liveUser.role !== 'admin' || sessionUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are permitted to perform this action.');
    }

    return liveUser;
  }

  /**
   * Validates and sanitizes settings loaded from localStorage with safe defaults
   */
  public validateAndSanitizeSettings(raw: unknown): SystemSettings {
    const fallback = MOCK_SETTINGS;
    if (!raw || typeof raw !== 'object') {
      return { ...fallback };
    }

    const data = raw as Record<string, unknown>;

    // String fields
    const portalName =
      typeof data.portalName === 'string' && data.portalName.trim()
        ? data.portalName.trim()
        : fallback.portalName;
    const academicYear =
      typeof data.academicYear === 'string' && data.academicYear.trim()
        ? data.academicYear.trim()
        : fallback.academicYear;
    const supportEmail =
      typeof data.supportEmail === 'string' && data.supportEmail.trim()
        ? data.supportEmail.trim()
        : fallback.supportEmail;
    const supportPhone =
      typeof data.supportPhone === 'string' && data.supportPhone.trim()
        ? data.supportPhone.trim()
        : fallback.supportPhone;

    // Supported priority values
    const defaultPriority: Priority =
      typeof data.defaultPriority === 'string' &&
      VALID_PRIORITIES.includes(data.defaultPriority as Priority)
        ? (data.defaultPriority as Priority)
        : fallback.defaultPriority;

    // Positive integer attachment count (1-10)
    let maxAttachmentsPerComplaint = fallback.maxAttachmentsPerComplaint;
    if (
      typeof data.maxAttachmentsPerComplaint === 'number' &&
      Number.isInteger(data.maxAttachmentsPerComplaint) &&
      data.maxAttachmentsPerComplaint >= 1
    ) {
      maxAttachmentsPerComplaint = Math.min(data.maxAttachmentsPerComplaint, 10);
    }

    // Positive finite attachment size (MB) (0.1 - 50 MB)
    let maxAttachmentSizeMB = fallback.maxAttachmentSizeMB;
    if (
      typeof data.maxAttachmentSizeMB === 'number' &&
      Number.isFinite(data.maxAttachmentSizeMB) &&
      data.maxAttachmentSizeMB > 0
    ) {
      maxAttachmentSizeMB = Math.min(Math.round(data.maxAttachmentSizeMB * 10) / 10, 50);
    }

    // Boolean flags with safe fallback
    const parseBool = (val: unknown, defaultVal: boolean): boolean =>
      typeof val === 'boolean' ? val : defaultVal;

    return {
      portalName,
      academicYear,
      supportEmail,
      supportPhone,
      defaultPriority,
      maxAttachmentsPerComplaint,
      maxAttachmentSizeMB,
      allowStudentRegistration: parseBool(
        data.allowStudentRegistration,
        fallback.allowStudentRegistration
      ),
      maintenanceMode: parseBool(data.maintenanceMode, fallback.maintenanceMode),
      autoAssignComplaints: parseBool(data.autoAssignComplaints, fallback.autoAssignComplaints),
      allowReopening: parseBool(data.allowReopening, fallback.allowReopening),
      allowAnonymousComplaints: parseBool(
        data.allowAnonymousComplaints,
        fallback.allowAnonymousComplaints
      ),
      studentNotifications: parseBool(data.studentNotifications, fallback.studentNotifications),
      emailNotifications: parseBool(data.emailNotifications, fallback.emailNotifications),
      smsNotifications: parseBool(data.smsNotifications, fallback.smsNotifications),
      pushNotifications: parseBool(data.pushNotifications, fallback.pushNotifications),
    };
  }

  /**
   * Pure synchronous read of settings with safe validation and fallback merge
   */
  public getSettingsSync(): SystemSettings {
    this.ensureInitialized();
    const stored = getStorageItem<unknown>(STORAGE_KEYS.SETTINGS, null);
    return this.validateAndSanitizeSettings(stored);
  }

  public async getSettings(): Promise<SystemSettings> {
    try {
      const res = await apiClient.get<any>('/settings');
      if (res && res.success && res.data) {
        const mapped = mapBackendSettings(res.data);
        setStorageItem(STORAGE_KEYS.SETTINGS, mapped);
        return mapped;
      }
    } catch (err: any) {
      if (err?.status === 401 || err?.status === 403) {
        if (!authService.isAuthenticated()) throw err;
      }
      // Offline fallback
    }

    return this.getSettingsSync();
  }

  public async updateSettings(data: Partial<SystemSettings>): Promise<SystemSettings> {
    const currentUser = authService.getCurrentUser();
    if (currentUser && currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are permitted to perform this action.');
    }

    try {
      const backendPayload = toBackendSettings(data);
      const res = await apiClient.patch<any>('/settings', backendPayload);
      if (res && res.success && res.data) {
        const mapped = mapBackendSettings(res.data);
        setStorageItem(STORAGE_KEYS.SETTINGS, mapped);
        return mapped;
      }
    } catch (err: any) {
      if (err?.status === 400 || err?.status === 401 || err?.status === 403) {
        throw new Error(err.message || 'Failed to update system settings.');
      }
      // Offline fallback
    }

    this.ensureInitialized();
    // Guard: Require an authenticated active administrator in USERS records
    this.assertAdminSession();

    const current = this.getSettingsSync();
    const cleanData: Partial<SystemSettings> = {};

    if (data.portalName !== undefined) {
      cleanData.portalName = data.portalName.trim() || current.portalName;
    }
    if (data.academicYear !== undefined) {
      cleanData.academicYear = data.academicYear.trim() || current.academicYear;
    }
    if (data.supportEmail !== undefined) {
      cleanData.supportEmail = data.supportEmail.trim() || current.supportEmail;
    }
    if (data.supportPhone !== undefined) {
      cleanData.supportPhone = data.supportPhone.trim() || current.supportPhone;
    }

    if (data.defaultPriority !== undefined) {
      if (!VALID_PRIORITIES.includes(data.defaultPriority)) {
        throw new Error(
          `Invalid priority "${data.defaultPriority}". Allowed values: low, medium, high, critical.`
        );
      }
      cleanData.defaultPriority = data.defaultPriority;
    }

    if (data.maxAttachmentsPerComplaint !== undefined) {
      const count = Number(data.maxAttachmentsPerComplaint);
      if (isNaN(count) || count < 1 || !Number.isInteger(count)) {
        throw new Error(
          'Maximum attachments per complaint must be a positive whole integer (at least 1).'
        );
      }
      cleanData.maxAttachmentsPerComplaint = Math.min(count, 10);
    }

    if (data.maxAttachmentSizeMB !== undefined) {
      const size = Number(data.maxAttachmentSizeMB);
      if (isNaN(size) || !Number.isFinite(size) || size <= 0) {
        throw new Error('Maximum attachment size must be a positive number greater than 0 MB.');
      }
      cleanData.maxAttachmentSizeMB = Math.min(Math.round(size * 10) / 10, 50);
    }

    // Boolean flags validation
    const validateBoolField = (key: keyof SystemSettings, val: unknown) => {
      if (typeof val !== 'boolean') {
        throw new Error(`Setting "${key}" must be a boolean value.`);
      }
      return val;
    };

    if (data.allowStudentRegistration !== undefined) {
      cleanData.allowStudentRegistration = validateBoolField(
        'allowStudentRegistration',
        data.allowStudentRegistration
      );
    }
    if (data.maintenanceMode !== undefined) {
      cleanData.maintenanceMode = validateBoolField('maintenanceMode', data.maintenanceMode);
    }
    if (data.autoAssignComplaints !== undefined) {
      cleanData.autoAssignComplaints = validateBoolField(
        'autoAssignComplaints',
        data.autoAssignComplaints
      );
    }
    if (data.allowReopening !== undefined) {
      cleanData.allowReopening = validateBoolField('allowReopening', data.allowReopening);
    }
    if (data.allowAnonymousComplaints !== undefined) {
      cleanData.allowAnonymousComplaints = validateBoolField(
        'allowAnonymousComplaints',
        data.allowAnonymousComplaints
      );
    }
    if (data.studentNotifications !== undefined) {
      cleanData.studentNotifications = validateBoolField(
        'studentNotifications',
        data.studentNotifications
      );
    }
    if (data.emailNotifications !== undefined) {
      cleanData.emailNotifications = validateBoolField(
        'emailNotifications',
        data.emailNotifications
      );
    }
    if (data.smsNotifications !== undefined) {
      cleanData.smsNotifications = validateBoolField('smsNotifications', data.smsNotifications);
    }
    if (data.pushNotifications !== undefined) {
      cleanData.pushNotifications = validateBoolField(
        'pushNotifications',
        data.pushNotifications
      );
    }

    const updated: SystemSettings = { ...current, ...cleanData };
    setStorageItem(STORAGE_KEYS.SETTINGS, updated);
    return updated;
  }

  /**
   * Resets all demo data across complaints, users, notifications, categories, and settings
   * to their initial pristine mock state. Requires administrator authorization.
   */
  public async resetDemoData(): Promise<void> {
    // Guard: Only authenticated administrators can reset demo data
    const activeAdmin = this.assertAdminSession();

    // Reset Complaints
    setStorageItem(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS);

    // Reset Users
    const resetUsers = MOCK_USERS.map((u) => ({
      ...u,
      status: u.status || 'active',
    }));
    setStorageItem(STORAGE_KEYS.USERS, resetUsers);

    // Reset Notifications
    setStorageItem(STORAGE_KEYS.NOTIFICATIONS, MOCK_NOTIFICATIONS);

    // Reset Categories
    setStorageItem(STORAGE_KEYS.CATEGORIES, MOCK_CATEGORIES);

    // Reset Settings
    setStorageItem(STORAGE_KEYS.SETTINGS, MOCK_SETTINGS);

    // Reset Broadcasts
    setStorageItem(STORAGE_KEYS.BROADCASTS, MOCK_BROADCASTS);

    // Safe session restoration for the authorized admin
    const restoredAdmin =
      resetUsers.find((u) => u.id === activeAdmin.id) ||
      resetUsers.find((u) => u.role === 'admin') ||
      activeAdmin;
    setStorageItem(STORAGE_KEYS.SESSION, restoredAdmin);
  }
}

export const settingsService = new SettingsService();
