import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@/components/common';
import { useAuth } from '@/hooks/useAuth';
import { useComplaints } from '@/hooks/useComplaints';

export const StudentDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { complaints, loading } = useComplaints();

  // Metrics
  const total = complaints.length;
  const pending = complaints.filter((c) => c.status === 'pending').length;
  const inProgress = complaints.filter((c) => c.status === 'in_progress' || c.status === 'assigned').length;
  const resolved = complaints.filter((c) => c.status === 'resolved').length;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-700 text-white shadow-md">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 text-white/90 text-[11px] font-medium backdrop-blur-xs mb-1">
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>Student Dashboard</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Welcome back, {user?.name || 'Student'}!
          </h2>
          <p className="text-xs text-indigo-100 max-w-xl">
            Track active maintenance requests and report issues across hostel rooms, lecture halls, and laboratories.
          </p>
        </div>

        <Link to="/student/complaints/new" className="shrink-0">
          <Button
            size="md"
            className="bg-white text-indigo-700 hover:bg-indigo-50 border-0 shadow-md font-semibold"
            leftIcon={<PlusCircle className="w-4 h-4" />}
          >
            Submit Complaint
          </Button>
        </Link>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card hoverEffect>
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Total Submitted
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
                Pending Review
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
                Active / Assigned
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {loading ? '...' : inProgress}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
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

      {/* Recent Complaints Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle>Recent Complaints</CardTitle>
            <CardDescription>
              Recent infrastructure and maintenance issues logged on your account
            </CardDescription>
          </div>
          <Link to="/student/complaints">
            <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
              View All
            </Button>
          </Link>
        </CardHeader>

        <CardContent>
          {complaints.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No complaints recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {complaints.slice(0, 4).map((c) => (
                <div
                  key={c.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 p-2 rounded-xl transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {c.ticketNumber}
                      </span>
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {c.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-md">
                      {c.description}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span>{c.location || 'Campus'}</span>
                      <span>•</span>
                      <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={c.priority} size="sm">
                      {c.priority}
                    </Badge>
                    <Badge variant={c.status} size="sm" dot>
                      {c.status.replace('_', ' ')}
                    </Badge>
                    <Link to={`/student/complaints/${c.id}`}>
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        Details
                      </Button>
                    </Link>
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
