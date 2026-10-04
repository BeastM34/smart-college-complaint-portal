import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  PieChart,
  Calendar,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
  Inbox,
  Layers,
  Wrench,
  CheckCheck,
  Building2,
  Activity,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  StatCard,
  SkeletonLoader,
  Button,
  Badge,
} from '@/components/common';
import {
  ComplaintTrendChart,
  CategoryBarChart,
  PriorityDistributionChart,
  StatusDonutChart,
  DepartmentPerformanceTable,
} from '@/components/charts';
import { analyticsService } from '@/services/analyticsService';
import { useToast } from '@/hooks/useToast';
import type { ComprehensiveAnalytics, DateRangeOption, ComplaintStatus } from '@/types';

const DATE_RANGE_OPTIONS: { id: DateRangeOption; label: string }[] = [
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: '3m', label: 'Last 3 Months' },
  { id: '6m', label: 'Last 6 Months' },
  { id: '1y', label: 'Last 1 Year' },
];

export const AdminAnalyticsPage: React.FC = () => {
  const [range, setRange] = useState<DateRangeOption>('30d');
  const [data, setData] = useState<ComprehensiveAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const { error: toastError } = useToast();

  const loadAnalytics = useCallback(
    async (selectedRange: DateRangeOption) => {
      setLoading(true);
      try {
        const result = await analyticsService.getAnalytics(selectedRange);
        setData(result);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Failed to compute institutional analytics';
        toastError(msg, 'Analytics Error');
      } finally {
        setLoading(false);
      }
    },
    [toastError]
  );

  useEffect(() => {
    loadAnalytics(range);
  }, [range, loadAnalytics]);

  // Transform statusDistribution array into format needed by StatusDonutChart
  const statusDataMap = React.useMemo(() => {
    const map: Record<ComplaintStatus, number> = {
      pending: 0,
      assigned: 0,
      in_progress: 0,
      resolved: 0,
      rejected: 0,
    };
    if (data?.statusDistribution) {
      data.statusDistribution.forEach((s) => {
        map[s.status] = s.count;
      });
    }
    return map;
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Page Header with Working Date Range Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Institutional Performance & Analytics
            </h1>
            <Badge variant="default" size="sm" className="hidden sm:inline-flex">
              Live Storage Data
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Dynamically computed metrics, resolution turnaround times, and departmental workflows.
          </p>
        </div>

        {/* Date Filter Tabs Bar */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 overflow-x-auto shrink-0">
          <Calendar className="w-4 h-4 text-slate-400 ml-2 mr-1 shrink-0" />
          {DATE_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setRange(opt.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                range === opt.id
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadAnalytics(range)}
            className="p-1.5 h-auto text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            title="Refresh metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* KPI Section: 9 Metric Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <SkeletonLoader count={5} height="5.5rem" />
          <SkeletonLoader count={4} height="5.5rem" />
        </div>
      ) : (
        <div className="space-y-3.5">
          {/* Top Row: Volume & Operational Status */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <StatCard
              title="Total Ingested"
              value={data?.totalComplaints ?? 0}
              subtitle={data?.periodLabel || 'In period'}
              icon={<BarChart3 className="w-5 h-5" />}
              variant="indigo"
            />
            <StatCard
              title="Pending Triage"
              value={data?.pendingComplaints ?? 0}
              subtitle="Unassigned queue"
              icon={<Inbox className="w-5 h-5" />}
              variant="amber"
            />
            <StatCard
              title="Assigned"
              value={data?.assignedComplaints ?? 0}
              subtitle="Technician dispatched"
              icon={<Wrench className="w-5 h-5" />}
              variant="violet"
            />
            <StatCard
              title="In Progress"
              value={data?.inProgressComplaints ?? 0}
              subtitle="Actively underway"
              icon={<Activity className="w-5 h-5" />}
              variant="blue"
            />
            <StatCard
              title="Resolved"
              value={data?.resolvedComplaints ?? 0}
              subtitle="Successfully fixed"
              icon={<CheckCircle2 className="w-5 h-5" />}
              variant="emerald"
            />
            <StatCard
              title="Rejected"
              value={data?.rejectedComplaints ?? 0}
              subtitle="Closed / duplicates"
              icon={<ShieldAlert className="w-5 h-5" />}
              variant="rose"
            />
          </div>

          {/* Bottom Row: Key Performance Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Card hoverEffect className="border-amber-200/60 dark:border-amber-900/40 bg-gradient-to-br from-white to-amber-50/20 dark:from-slate-900 dark:to-amber-950/10">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Active Complaint Queue
                  </p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                    {data?.activeQueue ?? 0}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Pending + Assigned + In-Progress
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card hoverEffect className="border-emerald-200/60 dark:border-emerald-900/40 bg-gradient-to-br from-white to-emerald-50/20 dark:from-slate-900 dark:to-emerald-950/10">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Resolution Rate
                  </p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {data?.totalComplaints && data.totalComplaints > 0
                      ? `${data.resolutionRate}%`
                      : 'N/A'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {data?.resolvedComplaints ?? 0} of {data?.totalComplaints ?? 0} tickets resolved
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
                  <CheckCheck className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card hoverEffect className="border-blue-200/60 dark:border-blue-900/40 bg-gradient-to-br from-white to-blue-50/20 dark:from-slate-900 dark:to-blue-950/10">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Average Resolution Time
                  </p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                    {data?.avgResolutionTimeFormatted ?? 'N/A'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Calculated from actual resolution timestamps
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
                  <Clock className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Trend Section: Dynamic Volume and Resolution Time Series */}
      <Card>
        <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle>Complaint Volume & Resolution Trend</CardTitle>
              <CardDescription>
                Chronological breakdown of incoming complaints and completed resolutions for {data?.periodLabel.toLowerCase() || 'selected period'}.
              </CardDescription>
            </div>
            <Badge variant="outline" size="sm">
              {data?.trendData.length || 0} time intervals
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          {loading ? (
            <SkeletonLoader height="14rem" />
          ) : (
            <ComplaintTrendChart data={data?.trendData || []} />
          )}
        </CardContent>
      </Card>

      {/* Distribution Section: 3-column breakdown of Category, Priority, and Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Breakdown */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Top Categories</CardTitle>
                <CardDescription>Volume by maintenance domain</CardDescription>
              </div>
              <PieChart className="w-4 h-4 text-slate-400" />
            </div>
          </CardHeader>
          <CardContent className="p-5 flex-1">
            {loading ? (
              <SkeletonLoader height="12rem" />
            ) : (
              <CategoryBarChart
                data={data?.categoryDistribution || []}
                total={data?.totalComplaints || 0}
              />
            )}
          </CardContent>
        </Card>

        {/* Priority Breakdown */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Priority Distribution</CardTitle>
                <CardDescription>Severity level allocation</CardDescription>
              </div>
              <ShieldAlert className="w-4 h-4 text-slate-400" />
            </div>
          </CardHeader>
          <CardContent className="p-5 flex-1">
            {loading ? (
              <SkeletonLoader height="12rem" />
            ) : (
              <PriorityDistributionChart
                data={data?.priorityDistribution || []}
                total={data?.totalComplaints || 0}
              />
            )}
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Workflow Statuses</CardTitle>
                <CardDescription>Current lifecycle breakdown</CardDescription>
              </div>
              <Layers className="w-4 h-4 text-slate-400" />
            </div>
          </CardHeader>
          <CardContent className="p-5 flex-1 flex items-center justify-center">
            {loading ? (
              <SkeletonLoader height="12rem" />
            ) : (
              <StatusDonutChart
                data={statusDataMap}
                total={data?.totalComplaints || 0}
                size={160}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Department Performance Section */}
      <Card>
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle>Department Operations & Resolution Performance</CardTitle>
              <CardDescription>
                Summary of ticket volume, pending backlog, active workload, and resolution rate by department.
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span>{data?.departmentPerformance.length || 0} Departments Active</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <SkeletonLoader count={4} height="2.5rem" />
            </div>
          ) : (
            <DepartmentPerformanceTable
              data={data?.departmentPerformance || []}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};
