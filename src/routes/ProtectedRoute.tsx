import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { Role } from '@/types';
import { SkeletonLoader } from '@/components/common/SkeletonLoader';

export interface ProtectedRouteProps {
  requiredRole?: Role;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiredRole }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
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

  // 1. Unauthenticated users attempting protected routes should go to /login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Role-based protection:
  // Students attempting /admin/* should be redirected to /student/dashboard
  if (requiredRole === 'admin' && user.role !== 'admin') {
    return <Navigate to="/student/dashboard" replace />;
  }

  // Admins attempting /student/* should be redirected to /admin/dashboard
  if (requiredRole === 'student' && user.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Outlet />;
};
