import type { SystemSettings } from '@/types';
import { STORAGE_KEYS, getStorageItem, setStorageItem } from '@/utils/storage';
import { MOCK_SETTINGS } from '@/data/mockData';

/**
 * Settings Service
 * Manages institutional portal settings and administrative preferences.
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
}

export const settingsService = new SettingsService();
