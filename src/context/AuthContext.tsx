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
  updateProfile: (data: Partial<User>) => Promise<User>;
  changePassword: (oldPass: string, newPass: string) => Promise<void>;
  switchRole: (role: Role) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize synchronously from storage to survive page refresh without flicker
  const [user, setUser] = useState<User | null>(() => authService.getCurrentUser());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const active = authService.getCurrentUser();
    setUser(active);
  }, []);

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
      setUser(created);
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
