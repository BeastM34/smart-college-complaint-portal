import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  Shield,
  Users,
  Tags,
} from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@/components/common';
import { useComplaints } from '@/hooks/useComplaints';

export const AdminDashboardPage: React.FC = () => {
  const { complaints, loading } = useComplaints();

  const total = complaints.length;
  const pending = complaints.filter((c) => c.status === 'pending').length;
  const inProgress = complaints.filter((c) => c.status === 'in_progress').length;
  const assigned = complaints.filter((c) => c.status === 'assigned').length;
  const resolved = complaints.filter((c) => c.status === 'resolved').length;
  const critical = complaints.filter((c) => c.priority === 'critical');

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-800 text-white shadow-md">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 text-white/90 text-[11px] font-medium backdrop-blur-xs mb-1">
            <Shield className="w-3 h-3 text-purple-200" />
            <span>Facility Administration Dashboard</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Campus Operations Overview
          </h2>
          <p className="text-xs text-purple-100 max-w-xl">
            Triage newly logged maintenance complaints, assign engineering staff, and monitor SLA compliance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/admin/complaints">
            <Button
              size="md"
              className="bg-white text-purple-900 hover:bg-purple-50 border-0 shadow-md font-semibold"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Triage Complaints
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card hoverEffect>
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Total Complaints
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {loading ? '...' : total}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card hoverEffect>
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                Pending Triage
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {loading ? '...' : pending}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card hoverEffect>
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                In Progress / Assigned
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {loading ? '...' : inProgress + assigned}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card hoverEffect>
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Resolved
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {loading ? '...' : resolved}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Critical Items Requiring Attention */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <CardTitle>Urgent & Critical Complaints</CardTitle>
            </div>
            <CardDescription>
              Tickets requiring immediate administrator review and emergency staff dispatch
            </CardDescription>
          </div>
          <Link to="/admin/complaints">
            <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
              All Complaints
            </Button>
          </Link>
        </CardHeader>

        <CardContent>
          {critical.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No critical tickets currently pending.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {critical.map((c) => (
                <div
                  key={c.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 p-2 rounded-xl transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-medium text-slate-500">
                        {c.ticketNumber}
                      </span>
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {c.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-lg">
                      {c.description}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span>Reported by {c.studentName}</span>
                      <span>•</span>
                      <span>{c.location || 'Campus'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={c.priority} size="sm">
                      {c.priority}
                    </Badge>
                    <Badge variant={c.status} size="sm" dot>
                      {c.status.replace('_', ' ')}
                    </Badge>
                    <Link to={`/admin/complaints/${c.id}`}>
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        Review & Assign
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Navigation Panels */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/admin/analytics" className="block group">
          <Card hoverEffect className="h-full">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Performance Analytics
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Resolution rate, department SLAs, and volume trends
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/users" className="block group">
          <Card hoverEffect className="h-full">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Staff & Student Directory
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Technician roster and student identity verification
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/admin/categories" className="block group">
          <Card hoverEffect className="h-full">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Tags className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Category Management
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Configure SLA thresholds and maintenance departments
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
};
