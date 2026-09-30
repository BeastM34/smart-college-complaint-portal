import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, EmptyState } from '@/components/common';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/utils/cn';

export const StudentNotificationsPage: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-rose-500" />;
      default:
        return <Info className="w-4 h-4 text-indigo-500" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Notifications Center
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Stay updated with real-time status transitions and assignments on your tickets.
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllAsRead}
            leftIcon={<CheckCheck className="w-4 h-4" />}
          >
            Mark all as read
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Bell className="w-6 h-6" />}
                title="No notifications"
                description="You're all caught up! Updates regarding your complaint tickets will appear here."
              />
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.read && markAsRead(n.id)}
                  className={cn(
                    'p-4 flex items-start gap-3.5 transition-colors cursor-pointer',
                    !n.read
                      ? 'bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/30'
                      : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                  )}
                >
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shrink-0">
                    {getIcon(n.type)}
                  </div>

                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn('text-xs font-semibold text-slate-900 dark:text-slate-100', !n.read && 'text-indigo-950 dark:text-indigo-200')}>
                        {n.title}
                      </p>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {n.message}
                    </p>

                    {n.link && (
                      <Link
                        to={n.link}
                        className="inline-block pt-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        View Ticket &rarr;
                      </Link>
                    )}
                  </div>

                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 shrink-0 mt-2" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
