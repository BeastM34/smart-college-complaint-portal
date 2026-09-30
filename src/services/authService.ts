import type { User, Role, RegisterData } from '@/types';
import { STORAGE_KEYS, getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storage';
import { MOCK_USERS } from '@/data/mockData';

/**
 * Authentication Service
 * Manages active session, credential validation, student registration,
 * password management, and role-based authorization.
 */
class AuthService {
  private activeUser: User | null = null;

  constructor() {
    this.ensureUsersSeeded();
    this.initSession();
  }

  private ensureUsersSeeded(): void {
    const existing = getStorageItem<User[] | null>(STORAGE_KEYS.USERS, null);
    if (!existing || existing.length === 0) {
      setStorageItem(STORAGE_KEYS.USERS, MOCK_USERS);
    }
  }

  private initSession(): void {
    const savedUser = getStorageItem<User | null>(STORAGE_KEYS.SESSION, null);
    if (savedUser) {
      this.activeUser = savedUser;
    } else {
      this.activeUser = null;
    }
  }

  public getCurrentUser(): User | null {
    const savedUser = getStorageItem<User | null>(STORAGE_KEYS.SESSION, null);
    this.activeUser = savedUser;
    return this.activeUser;
  }

  public async login(
    email: string,
    password?: string,
    rememberMe = true
  ): Promise<User> {
    this.ensureUsersSeeded();
    const users = getStorageItem<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
    const cleanEmail = email.trim().toLowerCase();

    const matched = users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!matched) {
      throw new Error('No account found with this college email address.');
    }

    if (password && matched.password && matched.password !== password) {
      throw new Error('Invalid email or password. Please verify your credentials.');
    }

    this.activeUser = matched;
    if (rememberMe) {
      setStorageItem(STORAGE_KEYS.SESSION, matched);
    } else {
      setStorageItem(STORAGE_KEYS.SESSION, matched);
    }
    return matched;
  }

  public async logout(): Promise<void> {
    this.activeUser = null;
    removeStorageItem(STORAGE_KEYS.SESSION);
  }

  public async register(data: RegisterData): Promise<User> {
    this.ensureUsersSeeded();
    const users = getStorageItem<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
    const cleanEmail = data.email.trim().toLowerCase();

    // Check duplicate email
    if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      throw new Error('An account with this college email already exists. Please sign in instead.');
    }

    // Check duplicate student ID
    if (data.studentId && users.some((u) => u.studentId?.toLowerCase() === data.studentId.trim().toLowerCase())) {
      throw new Error('A student profile with this Student ID is already registered.');
    }

    const newUser: User = {
      id: `stu-${Date.now()}`,
      name: data.name.trim(),
      email: cleanEmail,
      password: data.password,
      role: 'student', // Enforce student role
      studentId: data.studentId.trim(),
      department: data.department.trim(),
      year: data.year,
      phone: data.phone.trim(),
      createdAt: new Date().toISOString(),
    };

    const updatedUsers = [...users, newUser];
    setStorageItem(STORAGE_KEYS.USERS, updatedUsers);

    // Automatically set as active session
    this.activeUser = newUser;
    setStorageItem(STORAGE_KEYS.SESSION, newUser);

    return newUser;
  }

  public async updateProfile(userId: string, data: Partial<User>): Promise<User> {
    this.ensureUsersSeeded();
    const users = getStorageItem<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
    const index = users.findIndex((u) => u.id === userId);

    if (index === -1) {
      throw new Error(`User with ID ${userId} not found`);
    }

    const updated = { ...users[index], ...data };
    users[index] = updated;
    setStorageItem(STORAGE_KEYS.USERS, users);

    if (this.activeUser?.id === userId) {
      this.activeUser = updated;
      setStorageItem(STORAGE_KEYS.SESSION, updated);
    }

    return updated;
  }

  public async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    this.ensureUsersSeeded();
    const users = getStorageItem<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
    const index = users.findIndex((u) => u.id === userId);

    if (index === -1) {
      throw new Error(`User with ID ${userId} not found`);
    }

    const user = users[index];
    if (user.password && user.password !== oldPassword) {
      throw new Error('Current password does not match.');
    }

    user.password = newPassword;
    users[index] = user;
    setStorageItem(STORAGE_KEYS.USERS, users);

    if (this.activeUser?.id === userId) {
      this.activeUser.password = newPassword;
      setStorageItem(STORAGE_KEYS.SESSION, this.activeUser);
    }
  }

  public switchDemoRole(role: Role): User {
    this.ensureUsersSeeded();
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
