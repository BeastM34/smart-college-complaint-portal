import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  FileText,
  Bell,
  User,
  BarChart3,
  Users,
  Tags,
  Settings,
  GraduationCap,
  Shield,
  LifeBuoy,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useNotifications } from '@/hooks/useNotifications';
import type { Role } from '@/types';

export interface NavItemConfig {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: number | string;
}

export interface SidebarProps {
  role: Role;
  className?: string;
  onItemClick?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ role, className, onItemClick }) => {
  const { unreadCount } = useNotifications();

  const studentNavItems: NavItemConfig[] = [
    {
      label: 'Dashboard',
      path: '/student/dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      label: 'Submit Complaint',
      path: '/student/complaints/new',
      icon: <PlusCircle className="w-4 h-4" />,
    },
    {
      label: 'My Complaints',
      path: '/student/complaints',
      icon: <FileText className="w-4 h-4" />,
    },
    {
      label: 'Notifications',
      path: '/student/notifications',
      icon: <Bell className="w-4 h-4" />,
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    {
      label: 'Profile',
      path: '/student/profile',
      icon: <User className="w-4 h-4" />,
    },
  ];

  const adminNavItems: NavItemConfig[] = [
    {
      label: 'Dashboard',
      path: '/admin/dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      label: 'Complaints',
      path: '/admin/complaints',
      icon: <FileText className="w-4 h-4" />,
    },
    {
      label: 'Analytics',
      path: '/admin/analytics',
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      label: 'Users',
      path: '/admin/users',
      icon: <Users className="w-4 h-4" />,
    },
    {
      label: 'Categories',
      path: '/admin/categories',
      icon: <Tags className="w-4 h-4" />,
    },
    {
      label: 'Notifications',
      path: '/admin/notifications',
      icon: <Bell className="w-4 h-4" />,
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    {
      label: 'Settings',
      path: '/admin/settings',
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  const items = role === 'admin' ? adminNavItems : studentNavItems;

  return (
    <aside
      className={cn(
        'flex flex-col h-full w-64 border-r border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 transition-colors select-none',
        className
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-md shadow-indigo-500/20">
          {role === 'admin' ? (
            <Shield className="w-5 h-5" />
          ) : (
            <GraduationCap className="w-5 h-5" />
          )}
        </div>
        <div className="flex flex-col">
          <Link to="/" className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 hover:text-indigo-600 transition-colors">
            SmartCampus
          </Link>
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
            {role === 'admin' ? 'Admin Workspace' : 'Student Portal'}
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Navigation
        </p>
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/student/dashboard' || item.path === '/admin/dashboard'}
            onClick={onItemClick}
            className={({ isActive }) =>
              cn(
                'group flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition-all duration-150',
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-950/60 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
              )
            }
          >
            <div className="flex items-center gap-3">
              <span className="shrink-0 transition-colors group-hover:scale-105">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </div>
            {item.badge !== undefined && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white shadow-xs">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </div>

      {/* Support / Helpdesk footer badge */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800/80">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 dark:bg-slate-800/40 dark:border-slate-800 flex items-start gap-2.5">
          <LifeBuoy className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
              Campus Support
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Emergency: ext 4422
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};
