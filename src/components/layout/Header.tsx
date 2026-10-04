import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Bell, User, LogOut, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { ThemeToggle } from './ThemeToggle';
import { DemoModeIndicator } from '@/components/common/DemoModeIndicator';
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/common/Dropdown';
import { Avatar } from '@/components/common/Avatar';
import { Badge } from '@/components/common/Badge';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';

export interface HeaderProps {
  onMenuClick?: () => void;
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, title }) => {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const notificationsLink =
    user?.role === 'admin'
      ? '/admin/notifications'
      : user?.role === 'staff'
      ? '/staff/notifications'
      : '/student/notifications';
  const profileLink =
    user?.role === 'admin'
      ? '/admin/settings'
      : user?.role === 'staff'
      ? '/staff/profile'
      : '/student/profile';

  const handleLogoutConfirm = async () => {
    await logout();
    setShowLogoutDialog(false);
    navigate('/login');
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 md:px-6 backdrop-blur-md transition-colors dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex items-center gap-3">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
              aria-label="Open mobile navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          {title && (
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                {title}
              </h1>
            </div>
          )}
        </div>

        {/* Right tools: Demo indicator, Theme toggle, Notifications, Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          <DemoModeIndicator />

          <ThemeToggle />

          <Link
            to={notificationsLink}
            className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-xs">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>

          {/* User profile dropdown */}
          {user ? (
            <Dropdown
              align="right"
              trigger={
                <div className="flex items-center gap-2 pl-1 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg p-1">
                  <Avatar
                    src={user.avatarUrl}
                    name={user.name}
                    size="sm"
                    status="online"
                  />
                  <div className="hidden md:flex flex-col text-left">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {user.name}
                    </span>
                    <span className="text-[10px] text-slate-400 capitalize">
                      {user.role}
                    </span>
                  </div>
                </div>
              }
            >
              <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {user.name}
                  </p>
                  <Badge variant={user.role} size="sm">
                    {user.role}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
              </div>

              <div className="py-1">
                <DropdownItem
                  icon={<User className="w-4 h-4 text-slate-400" />}
                  onClick={() => navigate(profileLink)}
                >
                  {user.role === 'admin' ? 'System Settings' : 'My Profile'}
                </DropdownItem>
                {user.role === 'admin' && (
                  <DropdownItem
                    icon={<Shield className="w-4 h-4 text-slate-400" />}
                    onClick={() => navigate('/admin/users')}
                  >
                    Manage Users
                  </DropdownItem>
                )}
              </div>

              <DropdownDivider />

              <DropdownItem
                danger
                icon={<LogOut className="w-4 h-4" />}
                onClick={() => setShowLogoutDialog(true)}
              >
                Sign Out
              </DropdownItem>
            </Dropdown>
          ) : (
            <Link
              to="/login"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* Logout confirmation */}
      <ConfirmationDialog
        isOpen={showLogoutDialog}
        onClose={() => setShowLogoutDialog(false)}
        onConfirm={handleLogoutConfirm}
        title="Sign Out"
        message="Are you sure you want to end your current session? You can sign back in at any time."
        confirmText="Sign Out"
        cancelText="Stay Logged In"
        variant="danger"
      />
    </>
  );
};
