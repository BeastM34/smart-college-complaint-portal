import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/authService';
import type { Role } from '@/types';
import { SkeletonLoader } from '@/components/common/SkeletonLoader';

export interface ProtectedRouteProps {
  requiredRole?: Role;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiredRole }) => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-950">
        <div className="w-full max-w-md space-y-4">
          <SkeletonLoader variant="circular" className="mx-auto" />
          <SkeletonLoader variant="text" />
          <SkeletonLoader variant="rectangular" />
        </div>
      </div>
    );
  }

  // Verify live user status in storage to prevent access by deactivated accounts
  const liveUser = authService.getCurrentUser();

  // 1. Unauthenticated or deactivated users attempting protected routes should go to /login
  if (!isAuthenticated || !user || !liveUser || (liveUser.status || 'active') === 'inactive') {
    if (user?.status === 'inactive' || liveUser?.status === 'inactive') {
      logout();
      return (
        <Navigate
          to="/login"
          state={{ from: location, deactivated: true }}
          replace
        />
      );
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Role-based protection:
  // Students attempting /admin/* should be redirected to /student/dashboard
  if (requiredRole === 'admin' && liveUser.role !== 'admin') {
    return <Navigate to="/student/dashboard" replace />;
  }

  // Admins attempting /student/* should be redirected to /admin/dashboard
  if (requiredRole === 'student' && liveUser.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Outlet />;
};
