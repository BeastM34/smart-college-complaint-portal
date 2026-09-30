import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Role } from '@/types';
import { authService } from '@/services/authService';

interface AuthContextType {
  user: User | null;
  role: Role | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, role?: Role) => Promise<User>;
  logout: () => Promise<void>;
  switchRole: (role: Role) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize session from service
    const activeUser = authService.getCurrentUser();
    setUser(activeUser);
    setIsLoading(false);
  }, []);

  const login = async (email: string, role: Role = 'student'): Promise<User> => {
    setIsLoading(true);
    try {
      const loggedIn = await authService.login(email, role);
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
