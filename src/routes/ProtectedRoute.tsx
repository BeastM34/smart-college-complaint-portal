import React, { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/authService';
import type { Role } from '@/types';
import { SkeletonLoader } from '@/components/common/SkeletonLoader';
import { settingsService } from '@/services/settingsService';
import { MaintenancePage } from '@/pages/public/MaintenancePage';

export interface ProtectedRouteProps {
  requiredRole?: Role;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiredRole }) => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const location = useLocation();
  const isLoggingOutRef = useRef(false);

  // Pure read: inspect live user without mutating localStorage or authentication state
  const liveUser = user ? authService.getLiveUser(user.id) : null;
  const isDeactivated = Boolean(liveUser && (liveUser.status || 'active') === 'inactive');
  const isMissingAccount = Boolean(user && !liveUser);
  const isRoleMismatch = Boolean(user && liveUser && user.role !== liveUser.role);
  const isInvalidSession = !isAuthenticated || !user || isDeactivated || isMissingAccount || isRoleMismatch;

  // Invalidate session in an effect rather than during component rendering
  useEffect(() => {
    if (!isLoading && (isDeactivated || isMissingAccount || isRoleMismatch) && user) {
      if (!isLoggingOutRef.current) {
        isLoggingOutRef.current = true;
        logout().catch(() => {
          isLoggingOutRef.current = false;
        });
      }
    } else if (!isDeactivated && !isMissingAccount && !isRoleMismatch) {
      isLoggingOutRef.current = false;
    }
  }, [isLoading, isDeactivated, isMissingAccount, isRoleMismatch, user, logout]);

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

  // 1. Unauthenticated, deactivated, or missing users attempting protected routes should go to /login
  if (isInvalidSession) {
    return (
      <Navigate
        to="/login"
        state={{ from: location, deactivated: isDeactivated }}
        replace
      />
    );
  }

  // 2. Role-based protection:
  // Students attempting /admin/* should be redirected to /student/dashboard
  if (requiredRole === 'admin' && liveUser?.role !== 'admin') {
    return <Navigate to="/student/dashboard" replace />;
  }

  // Admins attempting /student/* should be redirected to /admin/dashboard
  if (requiredRole === 'student' && liveUser?.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  // 3. Maintenance Mode: Restrict student-facing access while preserving administrator access
  const isMaintenance = settingsService.getSettingsSync().maintenanceMode;
  if (isMaintenance && liveUser?.role !== 'admin') {
    return <MaintenancePage />;
  }

  return <Outlet />;
};
