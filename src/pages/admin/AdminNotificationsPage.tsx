import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, AlertTriangle, Info, CheckCircle2, Shield } from 'lucide-react';
import { Button, Card, CardContent, EmptyState } from '@/components/common';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/utils/cn';

export const AdminNotificationsPage: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Administrative Alerts
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Critical maintenance incidents, SLA breach warnings, and dispatch notifications.
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
                title="No admin alerts"
                description="All operational alerts and dispatch updates have been processed."
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
                      ? 'bg-purple-50/40 dark:bg-purple-950/20 hover:bg-purple-50/70'
                      : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                  )}
                >
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shrink-0">
                    {n.type === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
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
                        className="inline-block pt-1 text-[11px] font-medium text-purple-600 dark:text-purple-400 hover:underline"
                      >
                        Open Complaint Console &rarr;
                      </Link>
                    )}
                  </div>

                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-purple-600 shrink-0 mt-2" />
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
