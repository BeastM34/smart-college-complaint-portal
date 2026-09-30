import type { User, Role } from '@/types';
import { STORAGE_KEYS, getStorageItem, setStorageItem } from '@/utils/storage';
import { MOCK_USERS } from '@/data/mockData';

/**
 * User Service
 * Handles user management and profile updates.
 */
class UserService {
  private ensureInitialized(): void {
    const existing = getStorageItem<User[] | null>(STORAGE_KEYS.USERS, null);
    if (!existing || existing.length === 0) {
      setStorageItem(STORAGE_KEYS.USERS, MOCK_USERS);
    }
  }

  public async getUsers(role?: Role): Promise<User[]> {
    this.ensureInitialized();
    const users = getStorageItem<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
    if (role) {
      return users.filter((u) => u.role === role);
    }
    return users;
  }

  public async getUserById(id: string): Promise<User | null> {
    this.ensureInitialized();
    const users = getStorageItem<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
    return users.find((u) => u.id === id) || null;
  }

  public async updateProfile(id: string, data: Partial<User>): Promise<User> {
    this.ensureInitialized();
    const users = getStorageItem<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
    const index = users.findIndex((u) => u.id === id);

    if (index === -1) {
      throw new Error(`User with ID ${id} not found`);
    }

    const updatedUser = { ...users[index], ...data };
    users[index] = updatedUser;
    setStorageItem(STORAGE_KEYS.USERS, users);

    // If active session matches this user, update session as well
    const session = getStorageItem<User | null>(STORAGE_KEYS.SESSION, null);
    if (session && session.id === id) {
      setStorageItem(STORAGE_KEYS.SESSION, updatedUser);
    }

    return updatedUser;
  }
}

export const userService = new UserService();
