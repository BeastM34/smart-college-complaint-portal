import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileDrawer } from '@/components/layout/MobileDrawer';
import { Header } from '@/components/layout/Header';

export const StaffLayout: React.FC = () => {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const location = useLocation();

  const getPageTitle = (pathname: string): string => {
    if (pathname.includes('/staff/dashboard')) return 'Technician Dashboard';
    if (pathname.includes('/staff/complaints/')) return 'Assigned Ticket Resolution';
    if (pathname.includes('/staff/complaints')) return 'Assigned Work Queue';
    if (pathname.includes('/staff/notifications')) return 'Staff Notifications';
    if (pathname.includes('/staff/profile')) return 'Staff Profile';
    return 'Staff Portal';
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Desktop Sidebar */}
      <Sidebar role="staff" className="hidden lg:flex shrink-0" />

      {/* Mobile Drawer */}
      <MobileDrawer
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        role="staff"
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
