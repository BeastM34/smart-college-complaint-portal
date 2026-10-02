import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Role, RegisterData } from '@/types';
import { authService } from '@/services/authService';

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
  // Initialize synchronously from storage using pure validation check
  const [user, setUser] = useState<User | null>(() => {
    const check = authService.validateSession();
    return check.isValid ? check.user : null;
  });
  const [isLoading, setIsLoading] = useState(false);

  // Centralized session validation process
  const validateSession = useCallback((): boolean => {
    const sessionCheck = authService.validateSession();
    if (!sessionCheck.isValid) {
      if (authService.getSessionUser() || user) {
        authService.invalidateSession();
        setUser(null);
      }
      return false;
    }
    // Synchronize with live storage if updated
    if (
      sessionCheck.user &&
      (!user ||
        sessionCheck.user.id !== user.id ||
        sessionCheck.user.role !== user.role ||
        sessionCheck.user.status !== user.status ||
        sessionCheck.user.department !== user.department)
    ) {
      setUser(sessionCheck.user);
    }
    return true;
  }, [user]);

  // Centralized effect for session validation on mount and cross-tab storage events
  useEffect(() => {
    validateSession();
    const handleStorageChange = () => {
      validateSession();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
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

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

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
