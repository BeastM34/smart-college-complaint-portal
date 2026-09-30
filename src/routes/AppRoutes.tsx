import React from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';

// Layouts
import { PublicLayout } from '@/layouts/PublicLayout';
import { StudentLayout } from '@/layouts/StudentLayout';
import { AdminLayout } from '@/layouts/AdminLayout';

// Guard
import { ProtectedRoute } from './ProtectedRoute';

// Public Pages
import { HomePage } from '@/pages/public/HomePage';
import { LoginPage } from '@/pages/public/LoginPage';
import { RegisterPage } from '@/pages/public/RegisterPage';
import { ForgotPasswordPage } from '@/pages/public/ForgotPasswordPage';

// Student Pages
import { StudentDashboardPage } from '@/pages/student/StudentDashboardPage';
import { StudentComplaintsPage } from '@/pages/student/StudentComplaintsPage';
import { NewComplaintPage } from '@/pages/student/NewComplaintPage';
import { ComplaintDetailPage } from '@/pages/student/ComplaintDetailPage';
import { StudentNotificationsPage } from '@/pages/student/StudentNotificationsPage';
import { StudentProfilePage } from '@/pages/student/StudentProfilePage';

// Admin Pages
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { AdminComplaintsPage } from '@/pages/admin/AdminComplaintsPage';
import { AdminComplaintDetailPage } from '@/pages/admin/AdminComplaintDetailPage';
import { AdminAnalyticsPage } from '@/pages/admin/AdminAnalyticsPage';
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage';
import { AdminCategoriesPage } from '@/pages/admin/AdminCategoriesPage';
import { AdminNotificationsPage } from '@/pages/admin/AdminNotificationsPage';
import { AdminSettingsPage } from '@/pages/admin/AdminSettingsPage';

// Common
import { EmptyState, Button } from '@/components/common';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      {/* Protected Student Routes */}
      <Route element={<ProtectedRoute requiredRole="student" />}>
        <Route path="/student" element={<StudentLayout />}>
          <Route index element={<Navigate to="/student/dashboard" replace />} />
          <Route path="dashboard" element={<StudentDashboardPage />} />
          <Route path="complaints" element={<StudentComplaintsPage />} />
          <Route path="complaints/new" element={<NewComplaintPage />} />
          <Route path="complaints/:id" element={<ComplaintDetailPage />} />
          <Route path="notifications" element={<StudentNotificationsPage />} />
          <Route path="profile" element={<StudentProfilePage />} />
        </Route>
      </Route>

      {/* Protected Admin Routes */}
      <Route element={<ProtectedRoute requiredRole="admin" />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="complaints" element={<AdminComplaintsPage />} />
          <Route path="complaints/:id" element={<AdminComplaintDetailPage />} />
          <Route path="analytics" element={<AdminAnalyticsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="notifications" element={<AdminNotificationsPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>
      </Route>

      {/* 404 Fallback */}
      <Route
        path="*"
        element={
          <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
            <EmptyState
              title="Page Not Found (404)"
              description="The requested page could not be found within the Smart College Complaint Portal."
              action={
                <Link to="/">
                  <Button variant="primary" size="sm">
                    Return to Home
                  </Button>
                </Link>
              }
            />
          </div>
        }
      />
    </Routes>
  );
};
