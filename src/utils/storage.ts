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
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

/**
 * Safely retrieve and parse an item from localStorage
 */
export function getStorageItem<T>(key: StorageKey | string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }
  try {
    const item = window.localStorage.getItem(key);
    if (item === null || item === undefined) {
      return fallback;
    }
    return JSON.parse(item) as T;
  } catch (error) {
    console.warn(`[storage] Failed to parse key "${key}" from localStorage:`, error);
    return fallback;
  }
}

/**
 * Safely serialize and save an item to localStorage
 */
export function setStorageItem<T>(key: StorageKey | string, value: T): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    const serialized = JSON.stringify(value);
    window.localStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    console.error(`[storage] Failed to write key "${key}" to localStorage:`, error);
    return false;
  }
}

/**
 * Safely remove an item from localStorage
 */
export function removeStorageItem(key: StorageKey | string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`[storage] Failed to remove key "${key}" from localStorage:`, error);
    return false;
  }
}

/**
 * Check if a key exists in localStorage
 */
export function hasStorageItem(key: StorageKey | string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.localStorage.getItem(key) !== null;
}

/**
 * Clear all portal specific keys without wiping other origins
 */
export function clearAppStorage(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    Object.values(STORAGE_KEYS).forEach((key) => {
      window.localStorage.removeItem(key);
    });
  } catch (error) {
    console.error('[storage] Failed to clear app storage:', error);
  }
}
