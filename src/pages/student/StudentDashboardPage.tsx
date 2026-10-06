import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  ListFilter,
  Bell,
  ArrowRight,
  Sparkles,
  MapPin,
  Calendar,
  ExternalLink,
  UserCheck,
  XCircle,
  Activity,
  Building,
  RefreshCw,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  SkeletonLoader,
  EmptyState,
  StatCard,
} from '@/components/common';
import { StatusDonutChart } from '@/components/charts';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { complaintService } from '@/services/complaintService';
import type {
  Complaint,
  StudentComplaintStats,
  StudentActivityEvent,
  ComplaintStatus,
} from '@/types';

export const StudentDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [stats, setStats] = useState<StudentComplaintStats>({
    total: 0,
    pending: 0,
    assigned: 0,
    inProgress: 0,
    resolved: 0,
    rejected: 0,
    byStatus: {
      pending: 0,
      assigned: 0,
      in_progress: 0,
      resolved: 0,
      rejected: 0,
    },
  });
  const [activities, setActivities] = useState<StudentActivityEvent[]>([]);

  // Fetch dynamic data exclusively through complaintService
  const loadDashboardData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const studentIdentifier = user.id || user.email;
      const [fetchedComplaints, fetchedStats, fetchedActivity] = await Promise.all([
        complaintService.getStudentComplaints(studentIdentifier),
        complaintService.getStudentStats(studentIdentifier),
        complaintService.getStudentRecentActivity(studentIdentifier, 6),
      ]);

      setComplaints(fetchedComplaints);
      setStats(fetchedStats);
      setActivities(fetchedActivity);
    } catch (err) {
      console.error('Failed to load student dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Memoized deduplication ensuring 100% unique sibling keys when rendering complaints
  const uniqueComplaints = useMemo(() => {
    const seen = new Set<string>();
    const result: Complaint[] = [];
    for (const c of complaints) {
      if (!c || !c.id) continue;
      const idKey = c.id.trim().toLowerCase();
      if (seen.has(idKey)) continue;
      seen.add(idKey);
      result.push(c);
    }
    return result;
  }, [complaints]);

  // Helper for status badge formatting
  const formatStatus = (status: ComplaintStatus) => {
    switch (status) {
      case 'in_progress':
        return 'In Progress';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  // Helper for timeline status icon & styling
  const getActivityIcon = (status: ComplaintStatus) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
      case 'assigned':
        return <UserCheck className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />;
      case 'in_progress':
        return <Activity className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
      case 'resolved':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
      case 'rejected':
        return <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />;
      default:
        return <Activity className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const getActivityBg = (status: ComplaintStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-100 dark:bg-amber-950/70 border-amber-200 dark:border-amber-800/60';
      case 'assigned':
        return 'bg-violet-100 dark:bg-violet-950/70 border-violet-200 dark:border-violet-800/60';
      case 'in_progress':
        return 'bg-blue-100 dark:bg-blue-950/70 border-blue-200 dark:border-blue-800/60';
      case 'resolved':
        return 'bg-emerald-100 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800/60';
      case 'rejected':
        return 'bg-rose-100 dark:bg-rose-950/70 border-rose-200 dark:border-rose-800/60';
      default:
        return 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
    }
  };

  const formatActivityTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);

      if (diffHours < 1) return 'Just now';
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-700 text-white shadow-md p-6 sm:p-7">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white/95 text-xs font-medium backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Smart College Complaint Portal • Active Service</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {user?.name || 'Student'}!
            </h1>
            <p className="text-sm text-indigo-100 max-w-2xl leading-relaxed">
              {user?.department ? `${user.department} • ` : ''}
              {user?.studentId ? `ID: ${user.studentId} • ` : ''}
              Track resolution timelines and log hostel, lab, and campus facility tickets in real time.
            </p>
          </div>

          {/* Quick Action Buttons inside Welcome Banner */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link to="/student/complaints/new">
              <Button
                variant="primary"
                size="md"
                leftIcon={<PlusCircle className="w-4 h-4 text-indigo-600" />}
                className="bg-white text-indigo-700 hover:bg-indigo-50 border-0 shadow-sm font-semibold hover:shadow-md transition-all"
              >
                Submit Complaint
              </Button>
            </Link>

            <Link to="/student/complaints">
              <Button
                variant="outline"
                size="md"
                leftIcon={<ListFilter className="w-4 h-4 text-white" />}
                className="bg-white/10 hover:bg-white/20 text-white border-white/25 backdrop-blur-xs font-medium"
              >
                My Complaints
              </Button>
            </Link>

            <Link to="/student/notifications">
              <Button
                variant="outline"
                size="md"
                leftIcon={<Bell className="w-4 h-4 text-white" />}
                className="relative bg-white/10 hover:bg-white/20 text-white border-white/25 backdrop-blur-xs font-medium"
              >
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </Link>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-500/30 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Dynamic KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Complaints"
          value={loading ? <SkeletonLoader height="1.75rem" width="3rem" /> : stats.total}
          subtitle="All submitted requests"
          icon={<FileText className="w-5 h-5" />}
          variant="default"
        />

        <StatCard
          title="Pending Review"
          value={loading ? <SkeletonLoader height="1.75rem" width="3rem" /> : stats.pending}
          subtitle="Awaiting department triage"
          icon={<Clock className="w-5 h-5" />}
          variant="amber"
        />

        <StatCard
          title="In Progress"
          value={
            loading ? (
              <SkeletonLoader height="1.75rem" width="3rem" />
            ) : (
              stats.inProgress + stats.assigned
            )
          }
          subtitle={
            stats.assigned > 0
              ? `${stats.assigned} assigned, ${stats.inProgress} active`
              : 'Active maintenance'
          }
          icon={<AlertCircle className="w-5 h-5" />}
          variant="blue"
        />

        <StatCard
          title="Resolved"
          value={loading ? <SkeletonLoader height="1.75rem" width="3rem" /> : stats.resolved}
          subtitle="Verified & closed tickets"
          icon={<CheckCircle2 className="w-5 h-5" />}
          variant="emerald"
        />
      </div>

      {/* Middle Row: Status Overview Donut Chart & Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Status Overview Donut Chart (7 cols on LG) */}
        <div className="lg:col-span-7">
          <Card className="h-full flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <span>Status Overview</span>
                  <Badge variant="default" size="sm">
                    Live
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Distribution of your tickets across all lifecycle stages
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadDashboardData}
                title="Refresh stats"
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </CardHeader>

            <CardContent className="pt-4 pb-6 flex-1 flex items-center justify-center">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-8 gap-4 w-full">
                  <SkeletonLoader variant="circular" width="140px" height="140px" />
                  <SkeletonLoader count={3} height="1rem" width="60%" />
                </div>
              ) : stats.total === 0 ? (
                <EmptyState
                  title="No complaint status data"
                  description="Submit your first maintenance request to visualize status breakdown."
                  action={
                    <Link to="/student/complaints/new">
                      <Button size="sm" leftIcon={<PlusCircle className="w-3.5 h-3.5" />}>
                        Submit Complaint
                      </Button>
                    </Link>
                  }
                />
              ) : (
                <StatusDonutChart
                  data={stats.byStatus}
                  total={stats.total}
                  size={190}
                  className="w-full"
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity Timeline (5 cols on LG) */}
        <div className="lg:col-span-5">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base sm:text-lg">Recent Activity</CardTitle>
                <Badge variant="info" size="sm">
                  Timeline
                </Badge>
              </div>
              <CardDescription>
                Updates and stage progressions on your complaints
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto max-h-[360px] pr-2">
              {loading ? (
                <div className="space-y-4 py-2">
                  <SkeletonLoader count={4} height="3rem" />
                </div>
              ) : activities.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No timeline activities recorded yet.
                </div>
              ) : (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                  {activities.map((event) => (
                    <div key={event.id} className="relative group">
                      {/* Timeline dot */}
                      <div
                        className={`absolute -left-6 top-1 w-5 h-5 rounded-full border flex items-center justify-center shadow-2xs transition-transform group-hover:scale-110 ${getActivityBg(
                          event.status
                        )}`}
                      >
                        {getActivityIcon(event.status)}
                      </div>

                      {/* Content */}
                      <div className="space-y-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {event.ticketNumber}
                          </span>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {formatActivityTime(event.timestamp)}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug line-clamp-2">
                          {event.message}
                        </p>

                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                          <span className="capitalize font-medium text-slate-500 dark:text-slate-400">
                            {event.updatedBy}
                          </span>
                          <span>•</span>
                          <Badge variant={event.status} size="sm">
                            {formatStatus(event.status)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Complaints Section */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Recent Complaints</CardTitle>
              <Badge variant="default" size="sm">
                {uniqueComplaints.length} Total
              </Badge>
            </div>
            <CardDescription>
              Detailed view of recently logged college infrastructure and facility tickets
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/student/complaints">
              <Button
                variant="outline"
                size="sm"
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                View All Complaints
              </Button>
            </Link>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="space-y-3 py-4">
              <SkeletonLoader count={5} height="2.5rem" />
            </div>
          ) : uniqueComplaints.length === 0 ? (
            <EmptyState
              title="No complaints submitted yet"
              description="Report your first maintenance issue using the button below to alert our staff."
              action={
                <Link to="/student/complaints/new">
                  <Button size="sm" leftIcon={<PlusCircle className="w-4 h-4" />}>
                    Submit Complaint
                  </Button>
                </Link>
              }
            />
          ) : (
            <>
              {/* Desktop Table View (visible on medium & large screens) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                      <th className="py-3 px-3">ID</th>
                      <th className="py-3 px-3">Title</th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 px-3">Location</th>
                      <th className="py-3 px-3">Priority</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {uniqueComplaints.slice(0, 6).map((c) => (
                      <tr
                        key={c.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                      >
                        <td className="py-3.5 px-3 font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {c.ticketNumber}
                        </td>
                        <td className="py-3.5 px-3 max-w-xs">
                          <p className="font-medium text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {c.title}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate max-w-sm">
                            {c.description}
                          </p>
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className="capitalize text-slate-600 dark:text-slate-300">
                            {c.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[140px]">{c.location || 'Campus'}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <Badge variant={c.priority} size="sm">
                            {c.priority}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <Badge variant={c.status} size="sm" dot>
                            {formatStatus(c.status)}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap">
                          {new Date(c.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3.5 px-3 text-right whitespace-nowrap">
                          <Link to={`/student/complaints/${c.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              rightIcon={<ExternalLink className="w-3 h-3" />}
                              className="h-7 text-xs px-2.5 font-medium"
                            >
                              View
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View (visible on small mobile screens) */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {uniqueComplaints.slice(0, 5).map((c) => (
                  <div key={c.id} className="py-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {c.ticketNumber}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={c.priority} size="sm">
                          {c.priority}
                        </Badge>
                        <Badge variant={c.status} size="sm" dot>
                          {formatStatus(c.status)}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {c.title}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                        {c.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 truncate max-w-[150px]">
                          <Building className="w-3 h-3 text-slate-400 shrink-0" />
                          {c.location || 'Campus'}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {new Date(c.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>

                      <Link to={`/student/complaints/${c.id}`}>
                        <Button variant="outline" size="sm" className="h-7 text-xs px-2.5">
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
