/**
 * Local Storage Utilities with Namespaced Keys
 * Safe parsing and fallback handling for the Smart College Complaint Portal.
 */

export const STORAGE_KEYS = {
  USERS: 'scp_users',
  COMPLAINTS: 'scp_complaints',
  NOTIFICATIONS: 'scp_notifications',
  CATEGORIES: 'scp_categories',
  SETTINGS: 'scp_settings',
  SESSION: 'scp_session',
  THEME: 'scp_theme',
  BROADCASTS: 'scp_broadcasts',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

const memoryStorage = new Map<string, string>();

/**
 * Safely retrieve and parse an item from localStorage (with memory fallback)
 */
export function getStorageItem<T>(key: StorageKey | string, fallback: T): T {
  try {
    const raw =
      typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem(key)
        : memoryStorage.get(key);

    if (raw === null || raw === undefined) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`[storage] Failed to parse key "${key}" from localStorage:`, error);
    return fallback;
  }
}

/**
 * Safely serialize and save an item to localStorage (with memory fallback)
 */
export function setStorageItem<T>(key: StorageKey | string, value: T): boolean {
  try {
    const serialized = JSON.stringify(value);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, serialized);
    } else {
      memoryStorage.set(key, serialized);
    }
    return true;
  } catch (error) {
    console.error(`[storage] Failed to write key "${key}" to localStorage:`, error);
    return false;
  }
}

/**
 * Safely remove an item from localStorage (with memory fallback)
 */
export function removeStorageItem(key: StorageKey | string): boolean {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    } else {
      memoryStorage.delete(key);
    }
    return true;
  } catch (error) {
    console.error(`[storage] Failed to remove key "${key}" from localStorage:`, error);
    return false;
  }
}

/**
 * Check if a key exists in localStorage (with memory fallback)
 */
export function hasStorageItem(key: StorageKey | string): boolean {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem(key) !== null;
  }
  return memoryStorage.has(key);
}

/**
 * Clear all portal specific keys without wiping other origins
 */
export function clearAppStorage(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      Object.values(STORAGE_KEYS).forEach((key) => {
        window.localStorage.removeItem(key);
      });
    } else {
      memoryStorage.clear();
    }
  } catch (error) {
    console.error('[storage] Failed to clear app storage:', error);
  }
}
