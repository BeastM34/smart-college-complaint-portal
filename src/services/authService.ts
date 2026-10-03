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
  }

  private ensureUsersSeeded(): void {
    const existing = getStorageItem<User[] | null>(STORAGE_KEYS.USERS, null);
    if (!existing || existing.length === 0) {
      setStorageItem(STORAGE_KEYS.USERS, MOCK_USERS);
    }
  }

  /**
   * Pure read of the raw session user saved in storage (without validation or mutation).
   */
  public getSessionUser(): User | null {
    return getStorageItem<User | null>(STORAGE_KEYS.SESSION, null);
  }

  /**
   * Pure read of user in USERS storage by ID (without validation or mutation).
   */
  public getLiveUser(userId?: string): User | null {
    if (!userId) return null;
    const users = getStorageItem<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
    return users.find((u) => u.id === userId) || null;
  }

  /**
   * Pure read of current valid user without modifying storage, internal state, or activeUser.
   */
  public getCurrentUser(): User | null {
    const check = this.validateSession();
    return check.isValid ? check.user : null;
  }

  /**
   * Validates the active session state without modifying storage.
   * Returns validation status, live user record (if found), and reason for invalidity.
   */
  public validateSession(): {
    isValid: boolean;
    user: User | null;
    reason?: 'none' | 'missing' | 'inactive' | 'role_mismatch';
  } {
    const savedUser = this.getSessionUser();
    if (!savedUser) {
      return { isValid: false, user: null, reason: 'none' };
    }
    const liveUser = this.getLiveUser(savedUser.id);
    if (!liveUser) {
      return { isValid: false, user: null, reason: 'missing' };
    }
    if ((savedUser.status || 'active') === 'inactive' || (liveUser.status || 'active') === 'inactive') {
      return { isValid: false, user: liveUser, reason: 'inactive' };
    }
    if (!savedUser.role || !liveUser.role || savedUser.role !== liveUser.role) {
      return { isValid: false, user: null, reason: 'role_mismatch' };
    }
    return { isValid: true, user: liveUser };
  }

  /**
   * Explicitly invalidates the session and cleans up storage.
   */
  public invalidateSession(): void {
    this.activeUser = null;
    removeStorageItem(STORAGE_KEYS.SESSION);
  }

  public async login(
    emailOrCredentials: string | { email: string; password?: string; rememberMe?: boolean },
    rawPassword?: string,
    rememberMe = true
  ): Promise<User> {
    this.ensureUsersSeeded();
    const email = typeof emailOrCredentials === 'string' ? emailOrCredentials : emailOrCredentials.email;
    const password = typeof emailOrCredentials === 'string' ? rawPassword : emailOrCredentials.password;
    const shouldRemember = typeof emailOrCredentials === 'string' ? rememberMe : (emailOrCredentials.rememberMe ?? true);

    const users = getStorageItem<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail) {
      throw new Error('Please enter your college email address.');
    }

    if (!password || !password.trim()) {
      throw new Error('Password is required.');
    }

    const matched = users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!matched) {
      throw new Error('No account found with this college email address.');
    }

    if (matched.password && matched.password !== password) {
      throw new Error('Invalid email or password. Please verify your credentials.');
    }

    // Check account status: Inactive accounts are blocked from logging in
    if ((matched.status || 'active') === 'inactive') {
      throw new Error('Your account has been deactivated. Please contact an administrator.');
    }

    this.activeUser = matched;
    setStorageItem(STORAGE_KEYS.SESSION, matched);
    return matched;
  }

  public isUserActive(userId: string): boolean {
    const users = getStorageItem<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
    const matched = users.find((u) => u.id === userId);
    return matched ? (matched.status || 'active') === 'active' : false;
  }

  public async logout(): Promise<void> {
    this.invalidateSession();
  }

  public async register(data: RegisterData): Promise<User> {
    this.ensureUsersSeeded();
    const users = getStorageItem<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);

    // Validate required fields
    if (!data.name?.trim()) throw new Error('Full name is required.');
    if (!data.email?.trim()) throw new Error('College email is required.');
    if (!data.studentId?.trim()) throw new Error('Student ID / Roll number is required.');
    if (!data.department?.trim()) throw new Error('Department is required.');
    if (!data.phone?.trim()) throw new Error('Phone contact is required.');
    if (!data.password) throw new Error('Password is required.');

    const cleanEmail = data.email.trim().toLowerCase();
    const cleanStudentId = data.studentId.trim().toLowerCase();

    // Check duplicate email
    if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      throw new Error('An account with this college email already exists. Please sign in instead.');
    }

    // Check duplicate student ID
    if (users.some((u) => u.studentId && u.studentId.toLowerCase() === cleanStudentId)) {
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
      year: data.year || '1st Year',
      phone: data.phone.trim(),
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const updatedUsers = [...users, newUser];
    setStorageItem(STORAGE_KEYS.USERS, updatedUsers);

    // DO NOT set activeUser or session: student must manually sign in
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
