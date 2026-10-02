import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  Shield,
  Users,
  Activity,
  Calendar,
  Lock,
  MessageSquare,
  Sparkles,
  ExternalLink,
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
} from '@/components/common';
import { complaintService } from '@/services/complaintService';
import type { Complaint, AdminKPIStats, AdminActivityEvent, ComplaintStatus } from '@/types';

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminKPIStats | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [recentActivities, setRecentActivities] = useState<AdminActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [fetchedStats, fetchedComplaints, fetchedActivities] = await Promise.all([
        complaintService.getAdminStats(),
        complaintService.getComplaints(),
        complaintService.getAllRecentActivity(8),
      ]);
      setStats(fetchedStats);
      setComplaints(fetchedComplaints);
      setRecentActivities(fetchedActivities);
    } catch (err) {
      console.error('Failed to load admin dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Urgent complaints: critical or high priority that are not resolved or rejected
  const urgentComplaints = useMemo(() => {
    return complaints
      .filter(
        (c) =>
          (c.priority === 'critical' || c.priority === 'high') &&
          c.status !== 'resolved' &&
          c.status !== 'rejected'
      )
      .sort((a, b) => {
        // Critical first, then by date
        if (a.priority === 'critical' && b.priority !== 'critical') return -1;
        if (b.priority === 'critical' && a.priority !== 'critical') return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, 5);
  }, [complaints]);

  // Donut chart segments for status overview
  const donutSegments = useMemo(() => {
    if (!stats || stats.total === 0) return [];

    const statuses: { key: ComplaintStatus; label: string; color: string; count: number }[] = [
      { key: 'pending', label: 'Pending', color: '#f59e0b', count: stats.statusBreakdown.pending || 0 },
      { key: 'assigned', label: 'Assigned', color: '#8b5cf6', count: stats.statusBreakdown.assigned || 0 },
      { key: 'in_progress', label: 'In Progress', color: '#3b82f6', count: stats.statusBreakdown.in_progress || 0 },
      { key: 'resolved', label: 'Resolved', color: '#10b981', count: stats.statusBreakdown.resolved || 0 },
      { key: 'rejected', label: 'Rejected', color: '#f43f5e', count: stats.statusBreakdown.rejected || 0 },
    ];

    let accumulatedDegrees = 0;
    return statuses.map((item) => {
      const percentage = (item.count / stats.total) * 100;
      const degrees = (item.count / stats.total) * 360;
      const startDeg = accumulatedDegrees;
      accumulatedDegrees += degrees;
      return {
        ...item,
        percentage: Math.round(percentage),
        startDeg,
        degrees,
      };
    });
  }, [stats]);

  // Categories sorted by frequency
  const sortedCategories = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.categoryBreakdown)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
  }, [stats]);

  // Maximum count for daily trend bars
  const maxTrendCount = useMemo(() => {
    if (!stats || stats.dailyTrends.length === 0) return 1;
    return Math.max(...stats.dailyTrends.map((t) => t.count), 1);
  }, [stats]);

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonLoader variant="card" height={160} />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonLoader key={i} variant="card" height={100} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonLoader variant="card" height={320} />
          <SkeletonLoader variant="card" height={320} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-800 via-indigo-800 to-blue-900 text-white shadow-lg p-6 sm:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-purple-200 text-xs font-semibold">
              <Shield className="w-3.5 h-3.5 text-purple-300" />
              <span>Campus Facility Administration</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] text-purple-100 font-normal">Live Operations</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Administrator Control Center
            </h1>
            <p className="text-xs sm:text-sm text-purple-100 leading-relaxed">
              Triage student grievances in real-time, dispatch technicians to campus locations, monitor SLA compliance, and manage college infrastructure incidents.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="md"
              onClick={() => navigate('/admin/complaints')}
              className="bg-white text-indigo-900 hover:bg-purple-50 font-semibold shadow-md"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Triage Complaints
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => navigate('/admin/users')}
              className="border-white/30 text-white hover:bg-white/10"
              leftIcon={<Users className="w-4 h-4" />}
            >
              Staff Directory
            </Button>
          </div>
        </div>
      </div>

      {/* 6 KPI Cards (Dynamically Calculated) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Complaints */}
        <Card hoverEffect className="cursor-pointer" onClick={() => navigate('/admin/complaints')}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Total Complaints
              </span>
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {stats?.total ?? 0}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">All tickets logged</p>
            </div>
          </CardContent>
        </Card>

        {/* New Complaints */}
        <Card hoverEffect className="cursor-pointer" onClick={() => navigate('/admin/complaints')}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                New Complaints
              </span>
              <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {stats?.newComplaints ?? 0}
              </p>
              <p className="text-[11px] text-indigo-500 font-medium mt-0.5">Past 7 days / fresh</p>
            </div>
          </CardContent>
        </Card>

        {/* Pending */}
        <Card hoverEffect className="cursor-pointer" onClick={() => navigate('/admin/complaints?status=pending')}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Pending Triage
              </span>
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {stats?.pending ?? 0}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Awaiting assignment</p>
            </div>
          </CardContent>
        </Card>

        {/* In Progress */}
        <Card hoverEffect className="cursor-pointer" onClick={() => navigate('/admin/complaints?status=in_progress')}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                In Progress
              </span>
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats?.inProgress ?? 0}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Actively serviced</p>
            </div>
          </CardContent>
        </Card>

        {/* Resolved */}
        <Card hoverEffect className="cursor-pointer" onClick={() => navigate('/admin/complaints?status=resolved')}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Resolved
              </span>
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {stats?.resolved ?? 0}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Fixed & closed</p>
            </div>
          </CardContent>
        </Card>

        {/* Critical Complaints */}
        <Card hoverEffect className="cursor-pointer" onClick={() => navigate('/admin/complaints?priority=critical')}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                Critical Priority
              </span>
              <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                {stats?.critical ?? 0}
              </p>
              <p className="text-[11px] text-rose-500 font-medium mt-0.5">Immediate attention</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section: Status Donut, Category Bars, Priority Breakdown, Volume Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Status Donut Overview */}
        <Card>
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">Complaint Status Breakdown</CardTitle>
                <CardDescription className="text-xs">
                  Distribution of tickets across workflow stages
                </CardDescription>
              </div>
              <Badge variant="outline" size="sm">
                {stats?.total ?? 0} Total
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
              {/* SVG Donut */}
              <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 transform">
                  {donutSegments.map((segment) => {
                    const strokeDasharray = `${(segment.percentage * 251.2) / 100} 251.2`;
                    const strokeDashoffset = `-${(segment.startDeg / 360) * 251.2}`;
                    return (
                      <circle
                        key={segment.key}
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke={segment.color}
                        strokeWidth="16"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-500 ease-out hover:opacity-80"
                      />
                    );
                  })}
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
                    {stats?.total ?? 0}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Complaints
                  </span>
                </div>
              </div>

              {/* Legend with counts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xs">
                {donutSegments.map((seg) => (
                  <div
                    key={seg.key}
                    onClick={() => navigate(`/admin/complaints?status=${seg.key}`)}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {seg.label}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {seg.count}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-1">({seg.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chart 2: Top Categories Breakdown */}
        <Card>
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">Top Complaint Categories</CardTitle>
                <CardDescription className="text-xs">
                  Departments and facilities with highest issue volumes
                </CardDescription>
              </div>
              <Link to="/admin/complaints">
                <Button variant="ghost" size="sm" className="text-xs h-7">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-3.5">
            {sortedCategories.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No categories recorded yet.</p>
            ) : (
              sortedCategories.map(([category, count]) => {
                const total = stats?.total || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">
                        {category}
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {count} <span className="text-[11px] text-slate-400 font-normal">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Chart 3: Priority Distribution */}
        <Card>
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-base font-bold">Priority Breakdown</CardTitle>
            <CardDescription className="text-xs">
              Urgency level triage across all campus tickets
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Critical', key: 'critical', count: stats?.priorityBreakdown.critical || 0, bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-900/50' },
                { label: 'High', key: 'high', count: stats?.priorityBreakdown.high || 0, bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-900/50' },
                { label: 'Medium', key: 'medium', count: stats?.priorityBreakdown.medium || 0, bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-900/50' },
                { label: 'Low', key: 'low', count: stats?.priorityBreakdown.low || 0, bg: 'bg-slate-50 dark:bg-slate-800/40', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-700' },
              ].map((p) => {
                const total = stats?.total || 1;
                const pct = Math.round((p.count / total) * 100);
                return (
                  <div
                    key={p.key}
                    onClick={() => navigate(`/admin/complaints?priority=${p.key}`)}
                    className={`p-3.5 rounded-xl border ${p.border} ${p.bg} cursor-pointer hover:shadow-xs transition-shadow`}
                  >
                    <p className={`text-xs font-semibold ${p.text}`}>{p.label}</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                      {p.count}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{pct}% of total</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Chart 4: Complaint Volume Trend (7-Day Activity) */}
        <Card>
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">Complaint Submission Trend</CardTitle>
                <CardDescription className="text-xs">
                  Daily incoming tickets over the past 7 calendar days
                </CardDescription>
              </div>
              <Badge variant="default" size="sm">
                7 Days Activity
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <div className="flex items-end justify-between gap-2 h-40 pt-4">
              {stats?.dailyTrends.map((trend) => {
                const heightPct = Math.round((trend.count / maxTrendCount) * 100);
                return (
                  <div key={trend.date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                      {trend.count}
                    </span>
                    <div className="w-full max-w-[28px] bg-slate-100 dark:bg-slate-800 rounded-t-lg overflow-hidden flex items-end h-28">
                      <div
                        className="w-full bg-indigo-600 dark:bg-indigo-500 rounded-t-lg transition-all duration-500 hover:bg-indigo-700"
                        style={{ height: `${Math.max(heightPct, 8)}%` }}
                        title={`${trend.label}: ${trend.count} complaints`}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 truncate max-w-[42px] text-center">
                      {trend.label.split(',')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Urgent Complaints Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <CardTitle className="text-base font-bold">Urgent Complaints Requiring Action</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Critical & High-priority requests currently pending triage or awaiting resolution
            </CardDescription>
          </div>
          <Link to="/admin/complaints">
            <Button variant="outline" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
              View All Complaints
            </Button>
          </Link>
        </CardHeader>

        <CardContent className="p-0">
          {urgentComplaints.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                All Urgent Complaints Handled
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                No active critical or high-priority complaints are waiting for review at this time.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Ticket</th>
                    <th className="px-5 py-3 font-semibold">Title & Details</th>
                    <th className="px-5 py-3 font-semibold">Student</th>
                    <th className="px-5 py-3 font-semibold">Location</th>
                    <th className="px-5 py-3 font-semibold">Priority</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {urgentComplaints.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-mono font-medium text-slate-700 dark:text-slate-300">
                        {c.ticketNumber}
                      </td>
                      <td className="px-5 py-3.5 max-w-xs">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {c.title}
                        </p>
                        <p className="text-[11px] text-slate-400 capitalize">
                          {c.category}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {c.studentName}
                        </p>
                        <p className="text-[11px] text-slate-400">{c.department || 'Student'}</p>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                        {c.location || `${c.building || 'Campus'} ${c.roomNumber || ''}`.trim()}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={c.priority} size="sm">
                          {c.priority}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={c.status} size="sm" dot>
                          {c.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link to={`/admin/complaints/${c.id}`}>
                          <Button variant="primary" size="sm" className="h-7 text-xs">
                            Review & Assign
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom Grid: Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity Feed (2 Cols) */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <CardTitle className="text-base font-bold">Recent System Activity</CardTitle>
            </div>
            <span className="text-xs text-slate-400">Live Audit Trail</span>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            {recentActivities.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No recent timeline events found.</p>
            ) : (
              <div className="space-y-4">
                {recentActivities.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                      {act.isInternal ? (
                        <Lock className="w-4 h-4 text-amber-500" />
                      ) : (
                        <MessageSquare className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/admin/complaints/${act.complaintId}`}
                          className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {act.ticketNumber}
                        </Link>
                        {act.isInternal && (
                          <Badge variant="warning" size="sm" className="text-[10px] h-4">
                            Internal
                          </Badge>
                        )}
                        <Badge variant={act.status} size="sm" className="text-[10px] h-4">
                          {act.status.replace('_', ' ')}
                        </Badge>
                        <span className="text-[11px] text-slate-400 ml-auto">
                          {new Date(act.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 line-clamp-2">
                        {act.message}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        By {act.updatedBy} ({act.role}) • {new Date(act.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions (1 Col) */}
        <Card>
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-base font-bold">Admin Quick Actions</CardTitle>
            <CardDescription className="text-xs">
              Frequent management operations
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <button
              onClick={() => navigate('/admin/complaints?status=pending')}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-950/40 text-left transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Triage Pending Tickets
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {stats?.pending ?? 0} waiting for assignment
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-amber-600 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => navigate('/admin/complaints?priority=critical')}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 text-left transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Review Critical Issues
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {stats?.critical ?? 0} tickets flagged critical
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-rose-600 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => navigate('/admin/users')}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 hover:bg-slate-100 dark:hover:bg-slate-800/60 text-left transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Staff & Technician Roster
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Manage duty shifts & skills
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-purple-600 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => navigate('/admin/analytics')}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 hover:bg-slate-100 dark:hover:bg-slate-800/60 text-left transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Operations Analytics
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Detailed SLA & resolution metrics
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-indigo-600 group-hover:translate-x-1 transition-transform" />
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
