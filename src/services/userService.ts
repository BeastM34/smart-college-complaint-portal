import type { User, Role } from '@/types';
import { STORAGE_KEYS, getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storage';
import { MOCK_USERS } from '@/data/mockData';
import { authService } from './authService';

export interface UserFilterOptions {
  search?: string;
  department?: string;
  role?: Role | 'all';
  status?: 'active' | 'inactive' | 'all';
}

/**
 * User Service
 * Handles user directory, profile updates, status activation/deactivation, and role assignments.
 */
class UserService {
  private ensureInitialized(): void {
    const existing = getStorageItem<User[] | null>(STORAGE_KEYS.USERS, null);
    if (!existing || existing.length === 0) {
      const initialized = MOCK_USERS.map((u) => ({
        ...u,
        status: u.status || 'active',
      }));
      setStorageItem(STORAGE_KEYS.USERS, initialized);
    }
  }

  public async getUsers(filter?: UserFilterOptions): Promise<User[]> {
    this.ensureInitialized();
    let users = getStorageItem<User[]>(STORAGE_KEYS.USERS, MOCK_USERS).map((u) => ({
      ...u,
      status: u.status || 'active',
    }));

    if (!filter) return users;

    if (filter.role && filter.role !== 'all') {
      users = users.filter((u) => u.role === filter.role);
    }

    if (filter.status && filter.status !== 'all') {
      users = users.filter((u) => (u.status || 'active') === filter.status);
    }

    if (filter.department && filter.department !== 'all') {
      users = users.filter(
        (u) => u.department && u.department.toLowerCase() === filter.department?.toLowerCase()
      );
    }

    if (filter.search && filter.search.trim() !== '') {
      const q = filter.search.toLowerCase().trim();
      users = users.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.studentId && u.studentId.toLowerCase().includes(q)) ||
          (u.department && u.department.toLowerCase().includes(q))
      );
    }

    return users;
  }

  public async getUserById(id: string): Promise<User | null> {
    this.ensureInitialized();
    const users = getStorageItem<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
    const user = users.find((u) => u.id === id || u.studentId === id || u.email === id);
    if (!user) return null;
    return {
      ...user,
      status: user.status || 'active',
    };
  }

  public async toggleUserStatus(id: string): Promise<User> {
    this.ensureInitialized();
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are permitted to change user account status.');
    }

    const users = getStorageItem<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
    const index = users.findIndex((u) => u.id === id);

    if (index === -1) {
      throw new Error(`User with ID ${id} not found`);
    }

    const targetUser = users[index];
    const currentStatus = targetUser.status || 'active';
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';

    if (nextStatus === 'inactive') {
      // 1. Prevent admin from deactivating their own account
      if (currentUser.id === id && currentUser.role === 'admin') {
        throw new Error('You cannot deactivate your own account.');
      }

      // 2. Prevent deactivating the last active administrator
      if (targetUser.role === 'admin') {
        const activeAdmins = users.filter(
          (u) => u.role === 'admin' && (u.status || 'active') === 'active'
        );
        if (activeAdmins.length <= 1) {
          throw new Error('Cannot deactivate the only remaining active administrator.');
        }
      }
    }

    const updatedUser: User = {
      ...targetUser,
      status: nextStatus,
    };

    users[index] = updatedUser;
    setStorageItem(STORAGE_KEYS.USERS, users);

    // If active session belongs to this user, update session as well
    const session = getStorageItem<User | null>(STORAGE_KEYS.SESSION, null);
    if (session && session.id === id) {
      if (nextStatus === 'inactive') {
        removeStorageItem(STORAGE_KEYS.SESSION);
      } else {
        setStorageItem(STORAGE_KEYS.SESSION, updatedUser);
      }
    }

    return updatedUser;
  }

  public async updateUserRole(id: string, role: Role): Promise<User> {
    this.ensureInitialized();
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are permitted to change user roles.');
    }

    const users = getStorageItem<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
    const index = users.findIndex((u) => u.id === id);

    if (index === -1) {
      throw new Error(`User with ID ${id} not found`);
    }

    const targetUser = users[index];

    // Safeguards for demoting an administrator
    if (targetUser.role === 'admin' && role !== 'admin') {
      if (currentUser.id === id) {
        throw new Error('You cannot remove your own administrator privileges.');
      }

      const activeAdmins = users.filter(
        (u) => u.role === 'admin' && (u.status || 'active') === 'active'
      );
      if (activeAdmins.length <= 1) {
        throw new Error('Cannot change the role of the only remaining active administrator.');
      }
    }

    const updatedUser: User = {
      ...targetUser,
      role,
    };

    users[index] = updatedUser;
    setStorageItem(STORAGE_KEYS.USERS, users);

    const session = getStorageItem<User | null>(STORAGE_KEYS.SESSION, null);
    if (session && session.id === id) {
      setStorageItem(STORAGE_KEYS.SESSION, updatedUser);
    }

    return updatedUser;
  }

  public async updateProfile(id: string, data: Partial<User>): Promise<User> {
    this.ensureInitialized();
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('Unauthorized: An authenticated session is required to update a user profile.');
    }

    if (currentUser.role !== 'admin' && currentUser.id !== id) {
      throw new Error('Unauthorized: You can only update your own profile.');
    }

    const users = getStorageItem<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
    const index = users.findIndex((u) => u.id === id);

    if (index === -1) {
      throw new Error(`User with ID ${id} not found`);
    }

    // Prevent non-admins from changing their role, status, or email
    const sanitizedData = { ...data };
    if (currentUser.role !== 'admin') {
      delete sanitizedData.role;
      delete sanitizedData.status;
      delete sanitizedData.email;
    }

    const updatedUser = { ...users[index], ...sanitizedData };
    users[index] = updatedUser;
    setStorageItem(STORAGE_KEYS.USERS, users);

    // If active session matches this user, update session as well
    const session = getStorageItem<User | null>(STORAGE_KEYS.SESSION, null);
    if (session && session.id === id) {
      setStorageItem(STORAGE_KEYS.SESSION, updatedUser);
    }

    return updatedUser;
  }

  public async updateUser(id: string, data: Partial<User>): Promise<User> {
    return this.updateProfile(id, data);
  }
}

export const userService = new UserService();
