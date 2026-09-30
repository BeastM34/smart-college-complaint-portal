import type { User, Role } from '@/types';
import { STORAGE_KEYS, getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storage';
import { MOCK_USERS } from '@/data/mockData';

/**
 * Authentication Service
 * Manages active session, mock login, logout, and role switching.
 */
class AuthService {
  private activeUser: User | null = null;

  constructor() {
    this.initSession();
  }

  private initSession(): void {
    const savedUser = getStorageItem<User | null>(STORAGE_KEYS.SESSION, null);
    if (savedUser) {
      this.activeUser = savedUser;
    } else {
      // Default initial session for Phase 1 exploration is the demo student
      this.activeUser = MOCK_USERS[0];
      setStorageItem(STORAGE_KEYS.SESSION, this.activeUser);
    }
  }

  public getCurrentUser(): User | null {
    if (!this.activeUser) {
      this.activeUser = getStorageItem<User | null>(STORAGE_KEYS.SESSION, null);
    }
    return this.activeUser;
  }

  public async login(email: string, role: Role = 'student'): Promise<User> {
    // In Phase 1: mock login finding user by role or email
    const users = getStorageItem<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
    let matchedUser = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!matchedUser) {
      // Pick matching mock role or create temporary session user
      matchedUser = users.find((u) => u.role === role) || {
        id: `user-${Date.now()}`,
        name: email.split('@')[0].replace('.', ' '),
        email,
        role,
        createdAt: new Date().toISOString(),
      };
    }

    this.activeUser = matchedUser;
    setStorageItem(STORAGE_KEYS.SESSION, matchedUser);
    return matchedUser;
  }

  public async logout(): Promise<void> {
    this.activeUser = null;
    removeStorageItem(STORAGE_KEYS.SESSION);
  }

  public switchDemoRole(role: Role): User {
    const users = getStorageItem<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
    const target = users.find((u) => u.role === role) || MOCK_USERS[0];
    this.activeUser = target;
    setStorageItem(STORAGE_KEYS.SESSION, target);
    return target;
  }

  public isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }

  public hasRole(role: Role): boolean {
    const user = this.getCurrentUser();
    return user ? user.role === role : false;
  }
}

export const authService = new AuthService();
