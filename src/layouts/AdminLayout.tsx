import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileDrawer } from '@/components/layout/MobileDrawer';
import { Header } from '@/components/layout/Header';

export const AdminLayout: React.FC = () => {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const location = useLocation();

  const getPageTitle = (pathname: string): string => {
    if (pathname.includes('/admin/dashboard')) return 'Admin Overview';
    if (pathname.includes('/admin/complaints/')) return 'Complaint Triage & Resolution';
    if (pathname.includes('/admin/complaints')) return 'Complaint Management';
    if (pathname.includes('/admin/analytics')) return 'Performance Analytics';
    if (pathname.includes('/admin/users')) return 'User & Staff Directory';
    if (pathname.includes('/admin/categories')) return 'Category Management';
    if (pathname.includes('/admin/notifications')) return 'Admin Notifications';
    if (pathname.includes('/admin/settings')) return 'System Settings';
    return 'Admin Console';
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Desktop Sidebar */}
      <Sidebar role="admin" className="hidden lg:flex shrink-0" />

      {/* Mobile Drawer */}
      <MobileDrawer
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        role="admin"
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        <Header
          onMenuClick={() => setMobileDrawerOpen(true)}
          title={getPageTitle(location.pathname)}
        />

        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
