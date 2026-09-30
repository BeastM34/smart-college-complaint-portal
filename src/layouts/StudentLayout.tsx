import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileDrawer } from '@/components/layout/MobileDrawer';
import { Header } from '@/components/layout/Header';

export const StudentLayout: React.FC = () => {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const location = useLocation();

  const getPageTitle = (pathname: string): string => {
    if (pathname.includes('/student/dashboard')) return 'Student Dashboard';
    if (pathname.includes('/student/complaints/new')) return 'Submit Complaint';
    if (pathname.includes('/student/complaints/')) return 'Complaint Details';
    if (pathname.includes('/student/complaints')) return 'My Complaints';
    if (pathname.includes('/student/notifications')) return 'Notifications Center';
    if (pathname.includes('/student/profile')) return 'Student Profile';
    return 'Student Portal';
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Desktop Sidebar */}
      <Sidebar role="student" className="hidden lg:flex shrink-0" />

      {/* Mobile Drawer */}
      <MobileDrawer
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        role="student"
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
