import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { User, Role, RegisterData } from '@/types';
import { authService } from '@/services/authService';
import { STORAGE_KEYS } from '@/utils/storage';

interface AuthContextType {
  user: User | null;
  role: Role | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password?: string, rememberMe?: boolean) => Promise<User>;
  logout: () => Promise<void>;
  register: (data: RegisterData) => Promise<User>;
  getCurrentUser: () => User | null;
  validateSession: () => boolean;
  updateProfile: (data: Partial<User>) => Promise<User>;
  changePassword: (oldPass: string, newPass: string) => Promise<void>;
  switchRole: (role: Role) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Session initialization state: loading is true until initial validation completes
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const isCleaningUpRef = useRef(false);

  // Centralized session validation process
  const validateSession = useCallback((): boolean => {
    // 1. Read the saved session
    // 2. Check whether associated user still exists
    // 3. Check whether user account is active
    // 4. Check whether saved role matches user's actual role
    const sessionCheck = authService.validateSession();

    if (!sessionCheck.isValid) {
      // 6. If invalid, clear the invalid session safely
      if (authService.getSessionUser()) {
        authService.invalidateSession();
      }
      setUser((currentUser) => (currentUser !== null ? null : currentUser));
      return false;
    }

    // 5. If valid, restore the authenticated user
    setUser((currentUser) => {
      const nextUser = sessionCheck.user;
      if (!nextUser) return null;
      if (
        !currentUser ||
        nextUser.id !== currentUser.id ||
        nextUser.role !== currentUser.role ||
        nextUser.status !== currentUser.status ||
        nextUser.department !== currentUser.department
      ) {
        return nextUser;
      }
      return currentUser;
    });
    return true;
  }, []);

  // Centralized session initialization on mount and storage synchronization
  useEffect(() => {
    let isMounted = true;

    const initSession = async () => {
      try {
        validateSession();
        const freshUser = await authService.restoreSession();
        if (isMounted && freshUser) {
          setUser(freshUser);
        }
      } catch {
        // preserve local session state
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initSession();

    const handleStorageChange = (e: StorageEvent) => {
      if (!e.key || e.key === STORAGE_KEYS.SESSION || e.key === STORAGE_KEYS.USERS) {
        validateSession();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [validateSession]);

  const getCurrentUser = useCallback(() => {
    return authService.getCurrentUser();
  }, []);

  const login = async (
    email: string,
    password?: string,
    rememberMe = true
  ): Promise<User> => {
    setIsLoading(true);
    try {
      const loggedIn = await authService.login(email, password, rememberMe);
      setUser(loggedIn);
      return loggedIn;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = useCallback(async (): Promise<void> => {
    if (isCleaningUpRef.current) return;
    isCleaningUpRef.current = true;
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
      isCleaningUpRef.current = false;
    }
  }, []);

  const register = async (data: RegisterData): Promise<User> => {
    setIsLoading(true);
    try {
      const created = await authService.register(data);
      // Do not log in newly registered student automatically
      return created;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (data: Partial<User>): Promise<User> => {
    if (!user) throw new Error('No authenticated user session');
    setIsLoading(true);
    try {
      const updated = await authService.updateProfile(user.id, data);
      setUser(updated);
      return updated;
    } finally {
      setIsLoading(false);
    }
  };

  const changePassword = async (oldPass: string, newPass: string): Promise<void> => {
    if (!user) throw new Error('No authenticated user session');
    setIsLoading(true);
    try {
      await authService.changePassword(user.id, oldPass, newPass);
    } finally {
      setIsLoading(false);
    }
  };

  const switchRole = (role: Role): void => {
    const updated = authService.switchDemoRole(role);
    setUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        register,
        getCurrentUser,
        validateSession,
        updateProfile,
        changePassword,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
