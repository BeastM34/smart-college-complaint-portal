import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ExternalLink,
  Trash2,
  UserCheck,
  Megaphone,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  EmptyState,
  SkeletonLoader,
} from '@/components/common';
import { useNotifications } from '@/hooks/useNotifications';
import type { Notification, NotificationType } from '@/types';

type NotificationFilter = 'all' | 'unread' | 'work_orders' | 'broadcasts';

export const StaffNotificationsPage: React.FC = () => {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification } =
    useNotifications();
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (activeFilter === 'unread') return !n.read;
      if (activeFilter === 'work_orders') {
        return (
          n.category === 'complaint_assigned' ||
          n.category === 'status_changed' ||
          n.category === 'complaint_resolved'
        );
      }
      if (activeFilter === 'broadcasts') {
        return (
          n.category === 'system_notification' ||
          n.category === 'admin_message' ||
          n.userId === 'all_staff' ||
          n.userId === 'all'
        );
      }
      return true;
    });
  }, [notifications, activeFilter]);

  const getIcon = (type: NotificationType, category?: string) => {
    if (category === 'complaint_assigned') {
      return <UserCheck className="w-4 h-4 text-violet-600 dark:text-violet-400" />;
    }
    if (category === 'admin_message' || category === 'system_notification') {
      return <Megaphone className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
    }

    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
      default:
        return <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMin < 2) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Staff Notifications</span>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500 text-white">
                {unreadCount} unread
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Assignment alerts, administrative broadcasts, and ticket activity notifications.
          </p>
        </div>

        {notifications.length > 0 && (
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<CheckCheck className="w-3.5 h-3.5" />}
                onClick={() => markAllAsRead()}
              >
                Mark all read
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 text-xs w-fit">
        {[
          { id: 'all', label: 'All Alerts' },
          { id: 'unread', label: `Unread (${unreadCount})` },
          { id: 'work_orders', label: 'Work Orders' },
          { id: 'broadcasts', label: 'Broadcasts' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id as NotificationFilter)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              activeFilter === tab.id
                ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <Card>
        <CardContent className="p-0 divide-y divide-slate-100 dark:divide-slate-800/80">
          {loading ? (
            <div className="p-6 space-y-4">
              <SkeletonLoader height="3.5rem" />
              <SkeletonLoader height="3.5rem" />
              <SkeletonLoader height="3.5rem" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Bell className="w-8 h-8 text-slate-400" />}
                title="No notifications found"
                description={
                  activeFilter === 'all'
                    ? 'You have no notifications in your inbox.'
                    : `No notifications match the "${activeFilter}" filter.`
                }
              />
            </div>
          ) : (
            filteredNotifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 sm:p-5 flex items-start justify-between gap-4 transition-colors ${
                  !n.read
                    ? 'bg-indigo-50/40 dark:bg-indigo-950/20'
                    : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="mt-0.5 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shrink-0 shadow-xs">
                    {getIcon(n.type, n.category)}
                  </div>

                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4
                        className={`text-sm tracking-tight truncate ${
                          !n.read
                            ? 'font-bold text-slate-900 dark:text-slate-100'
                            : 'font-medium text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {n.title}
                      </h4>
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {n.message}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(n.createdAt)}
                      </span>
                      {(n.link || n.complaintId) && (
                        <Link
                          to={n.link ? n.link.replace('/student/complaints/', '/staff/complaints/') : `/staff/complaints/${n.complaintId}`}
                          className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 inline-flex items-center gap-1"
                        >
                          <span>View Ticket</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!n.read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAsRead(n.id)}
                      className="text-xs h-7 px-2"
                      title="Mark as read"
                    >
                      Read
                    </Button>
                  )}
                  <button
                    onClick={() => deleteNotification(n.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                    aria-label="Delete notification"
                    title="Delete notification"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};
