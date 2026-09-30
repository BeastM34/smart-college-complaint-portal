import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { GraduationCap, ArrowRight } from 'lucide-react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { DemoModeIndicator } from '@/components/common/DemoModeIndicator';
import { Button } from '@/components/common/Button';
import { useAuth } from '@/hooks/useAuth';

export const PublicLayout: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-md shadow-indigo-500/20">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
                SmartCampus
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs text-slate-400 font-medium border-l border-slate-200 dark:border-slate-800 pl-2">
                Complaint Portal
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <DemoModeIndicator />
            <ThemeToggle />

            {user ? (
              <Link to={user.role === 'admin' ? '/admin/dashboard' : '/student/dashboard'}>
                <Button size="sm" variant="primary" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                  Go to {user.role === 'admin' ? 'Admin' : 'Student'} Portal
                </Button>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="primary" size="sm">
                    Register
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 py-8 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>&copy; {new Date().getFullYear()} Smart College Complaint Portal. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/login" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
              Student Login
            </Link>
            <Link to="/login" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
              Admin Portal
            </Link>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span>Helpline: +1 (800) 555-CAMPUS</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
