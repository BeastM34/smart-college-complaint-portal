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

/**
 * Settings Service
 * Manages institutional portal settings, administrative preferences, and demo data reset.
 */
class SettingsService {
  private ensureInitialized(): void {
    const existing = getStorageItem<Partial<SystemSettings> | null>(STORAGE_KEYS.SETTINGS, null);
    if (!existing) {
      setStorageItem(STORAGE_KEYS.SETTINGS, MOCK_SETTINGS);
    }
  }

  /**
   * Pure synchronous read of settings with safe fallback merge
   */
  public getSettingsSync(): SystemSettings {
    this.ensureInitialized();
    const stored = getStorageItem<Partial<SystemSettings> | null>(STORAGE_KEYS.SETTINGS, null);
    return {
      ...MOCK_SETTINGS,
      ...(stored || {}),
    };
  }

  public async getSettings(): Promise<SystemSettings> {
    return this.getSettingsSync();
  }

  public async updateSettings(data: Partial<SystemSettings>): Promise<SystemSettings> {
    this.ensureInitialized();

    // Guard: Only administrators can modify system settings
    const sessionUser = getStorageItem<User | null>(STORAGE_KEYS.SESSION, null);
    if (sessionUser && sessionUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators can modify system settings.');
    }

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
      const allowed: Priority[] = ['low', 'medium', 'high', 'critical'];
      if (!allowed.includes(data.defaultPriority)) {
        throw new Error(`Invalid priority "${data.defaultPriority}". Allowed values: low, medium, high, critical.`);
      }
      cleanData.defaultPriority = data.defaultPriority;
    }

    if (data.maxAttachmentsPerComplaint !== undefined) {
      const count = Number(data.maxAttachmentsPerComplaint);
      if (isNaN(count) || count < 1 || !Number.isInteger(count)) {
        throw new Error('Maximum attachments per complaint must be a positive whole integer (at least 1).');
      }
      cleanData.maxAttachmentsPerComplaint = Math.min(count, 10);
    }

    if (data.maxAttachmentSizeMB !== undefined) {
      const size = Number(data.maxAttachmentSizeMB);
      if (isNaN(size) || size <= 0) {
        throw new Error('Maximum attachment size must be a positive number greater than 0 MB.');
      }
      cleanData.maxAttachmentSizeMB = Math.min(Math.round(size * 10) / 10, 50);
    }

    // Boolean flags
    if (data.allowStudentRegistration !== undefined) {
      cleanData.allowStudentRegistration = Boolean(data.allowStudentRegistration);
    }
    if (data.maintenanceMode !== undefined) {
      cleanData.maintenanceMode = Boolean(data.maintenanceMode);
    }
    if (data.autoAssignComplaints !== undefined) {
      cleanData.autoAssignComplaints = Boolean(data.autoAssignComplaints);
    }
    if (data.allowReopening !== undefined) {
      cleanData.allowReopening = Boolean(data.allowReopening);
    }
    if (data.allowAnonymousComplaints !== undefined) {
      cleanData.allowAnonymousComplaints = Boolean(data.allowAnonymousComplaints);
    }
    if (data.studentNotifications !== undefined) {
      cleanData.studentNotifications = Boolean(data.studentNotifications);
    }
    if (data.emailNotifications !== undefined) {
      cleanData.emailNotifications = Boolean(data.emailNotifications);
    }
    if (data.smsNotifications !== undefined) {
      cleanData.smsNotifications = Boolean(data.smsNotifications);
    }
    if (data.pushNotifications !== undefined) {
      cleanData.pushNotifications = Boolean(data.pushNotifications);
    }

    const updated: SystemSettings = { ...current, ...cleanData };
    setStorageItem(STORAGE_KEYS.SETTINGS, updated);
    return updated;
  }

  /**
   * Resets all demo data across complaints, users, notifications, categories, and settings
   * to their initial pristine mock state while safely maintaining authentication state.
   */
  public async resetDemoData(): Promise<void> {
    const currentSession = getStorageItem<User | null>(STORAGE_KEYS.SESSION, null);

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

    // Safe session restoration
    if (currentSession) {
      const liveUserInMock = resetUsers.find((u) => u.id === currentSession.id);
      if (liveUserInMock) {
        setStorageItem(STORAGE_KEYS.SESSION, liveUserInMock);
      } else if (currentSession.role === 'admin') {
        const defaultAdmin = resetUsers.find((u) => u.role === 'admin') || resetUsers[0];
        setStorageItem(STORAGE_KEYS.SESSION, defaultAdmin);
      } else {
        const defaultStudent = resetUsers.find((u) => u.role === 'student') || resetUsers[0];
        setStorageItem(STORAGE_KEYS.SESSION, defaultStudent);
      }
    }
  }
}

export const settingsService = new SettingsService();
