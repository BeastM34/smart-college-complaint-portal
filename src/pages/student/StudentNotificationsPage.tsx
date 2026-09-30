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
  Filter,
  Check,
  UserCheck,
  Megaphone,
  Radio,
  Sparkles,
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

type NotificationFilter = 'all' | 'unread' | 'complaints' | 'system';

export const StudentNotificationsPage: React.FC = () => {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification } =
    useNotifications();
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (activeFilter === 'unread') return !n.read;
      if (activeFilter === 'complaints') {
        return (
          n.link?.includes('/complaints/') ||
          n.category === 'complaint_submitted' ||
          n.category === 'complaint_assigned' ||
          n.category === 'status_changed' ||
          n.category === 'complaint_resolved'
        );
      }
      if (activeFilter === 'system') {
        return (
          n.category === 'system_notification' ||
          n.category === 'admin_message' ||
          n.userId === 'all_students' ||
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Notification Center
            </h1>
            {unreadCount > 0 ? (
              <Badge variant="pending" size="sm">
                {unreadCount} Unread
              </Badge>
            ) : (
              <Badge variant="default" size="sm">
                All Read
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time updates regarding your complaint submissions, technician assignments, and campus notices.
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllAsRead}
            leftIcon={<CheckCheck className="w-4 h-4 text-indigo-600" />}
            className="shrink-0"
          >
            Mark all as read
          </Button>
        )}
      </div>

      {/* Filter Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeFilter === 'all'
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          All ({notifications.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('unread')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeFilter === 'unread'
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          Unread ({unreadCount})
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('complaints')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeFilter === 'complaints'
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          Ticket Updates
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('system')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeFilter === 'system'
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          System & Broadcasts
        </button>
      </div>

      {/* Notifications List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              <SkeletonLoader count={5} height="3.5rem" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Bell className="w-8 h-8 text-indigo-400" />}
                title={
                  activeFilter === 'unread'
                    ? 'No unread notifications'
                    : 'No notifications in this view'
                }
                description={
                  activeFilter === 'unread'
                    ? "You're all caught up! As technicians update your requests, new alerts will appear here."
                    : 'Check back later for campus facility updates and alerts.'
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredNotifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 sm:p-5 flex items-start justify-between gap-4 transition-colors group ${
                    !n.read
                      ? 'bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/30'
                      : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {/* Icon indicator */}
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shrink-0 shadow-2xs">
                      {getIcon(n.type, n.category)}
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4
                          className={`text-xs sm:text-sm font-semibold truncate ${
                            !n.read
                              ? 'text-slate-900 dark:text-slate-100 font-bold'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {n.title}
                        </h4>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 shrink-0" />
                        )}
                        <span className="text-[11px] text-slate-400 ml-auto shrink-0">
                          {formatRelativeTime(n.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {n.message}
                      </p>

                      {/* Related Ticket Link */}
                      {n.link && (
                        <div className="pt-1.5">
                          <Link
                            to={n.link}
                            onClick={() => !n.read && markAsRead(n.id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline"
                          >
                            <span>View Complaint Details</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions (Mark read, delete) */}
                  <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                    {!n.read && (
                      <button
                        type="button"
                        onClick={() => markAsRead(n.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteNotification(n.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="Delete notification"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
