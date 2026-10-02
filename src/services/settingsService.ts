import type { SystemSettings } from '@/types';
import { STORAGE_KEYS, getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storage';
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
    const existing = getStorageItem<SystemSettings | null>(STORAGE_KEYS.SETTINGS, null);
    if (!existing) {
      setStorageItem(STORAGE_KEYS.SETTINGS, MOCK_SETTINGS);
    }
  }

  public async getSettings(): Promise<SystemSettings> {
    this.ensureInitialized();
    return getStorageItem<SystemSettings>(STORAGE_KEYS.SETTINGS, MOCK_SETTINGS);
  }

  public async updateSettings(data: Partial<SystemSettings>): Promise<SystemSettings> {
    this.ensureInitialized();
    const current = getStorageItem<SystemSettings>(STORAGE_KEYS.SETTINGS, MOCK_SETTINGS);
    const updated = { ...current, ...data };
    setStorageItem(STORAGE_KEYS.SETTINGS, updated);
    return updated;
  }

  /**
   * Resets all demo data across complaints, users, notifications, categories, and settings
   * to their initial pristine mock state.
   */
  public async resetDemoData(): Promise<void> {
    // Reset Complaints
    setStorageItem(STORAGE_KEYS.COMPLAINTS, MOCK_COMPLAINTS);

    // Reset Users
    setStorageItem(
      STORAGE_KEYS.USERS,
      MOCK_USERS.map((u) => ({
        ...u,
        status: u.status || 'active',
      }))
    );

    // Reset Notifications
    setStorageItem(STORAGE_KEYS.NOTIFICATIONS, MOCK_NOTIFICATIONS);

    // Reset Categories
    setStorageItem(STORAGE_KEYS.CATEGORIES, MOCK_CATEGORIES);

    // Reset Settings
    setStorageItem(STORAGE_KEYS.SETTINGS, MOCK_SETTINGS);

    // Reset Broadcasts
    setStorageItem(STORAGE_KEYS.BROADCASTS, MOCK_BROADCASTS);
  }
}

export const settingsService = new SettingsService();
