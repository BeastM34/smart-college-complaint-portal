import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Clock, CheckCircle2, PieChart, Info } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, SkeletonLoader } from '@/components/common';
import { analyticsService } from '@/services/analyticsService';
import type { AnalyticsSummary } from '@/types';

export const AdminAnalyticsPage: React.FC = () => {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsService
      .getSummary()
      .then((res) => setData(res))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Performance & SLA Analytics
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Institutional turnaround times, category frequency, and complaint volume trends.
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800">
          <Info className="w-3.5 h-3.5" />
          <span>Phase 1 Scaffolding Placeholder</span>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonLoader variant="card" count={4} />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card hoverEffect>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Ingested</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {data?.totalComplaints}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card hoverEffect>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Avg Resolution</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {data?.avgResolutionTimeHours} hrs
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card hoverEffect>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Resolved Rate</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {data
                    ? Math.round(
                        (data.resolvedComplaints / (data.totalComplaints || 1)) * 100
                      )
                    : 0}
                  %
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card hoverEffect>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Active Queue</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {(data?.pendingComplaints || 0) + (data?.inProgressComplaints || 0)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart Placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Complaints by Category</CardTitle>
                <CardDescription>Distribution across campus maintenance domains</CardDescription>
              </div>
              <PieChart className="w-4 h-4 text-slate-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {data &&
              Object.entries(data.complaintsByCategory).map(([cat, count]) => {
                const pct = Math.round((count / (data.totalComplaints || 1)) * 100);
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="capitalize font-medium text-slate-700 dark:text-slate-300">
                        {cat}
                      </span>
                      <span className="text-slate-400">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Resolution Trends</CardTitle>
            <CardDescription>Submitted tickets vs successfully resolved</CardDescription>
          </CardHeader>
          <CardContent className="h-64 flex flex-col justify-end">
            <div className="flex items-end justify-between h-44 gap-3 px-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              {data?.monthlyTrends.map((t) => (
                <div key={t.month} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <div className="w-full flex items-end justify-center gap-1 h-36">
                    <div
                      className="w-3 bg-indigo-500/70 rounded-t"
                      style={{ height: `${Math.min(100, (t.submitted / 90) * 100)}%` }}
                      title={`Submitted: ${t.submitted}`}
                    />
                    <div
                      className="w-3 bg-emerald-500/70 rounded-t"
                      style={{ height: `${Math.min(100, (t.resolved / 90) * 100)}%` }}
                      title={`Resolved: ${t.resolved}`}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">{t.month}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-4 text-xs pt-3 text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500" />
                <span>Submitted</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
                <span>Resolved</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
