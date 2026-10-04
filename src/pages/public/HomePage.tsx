import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Clock,
  Bell,
  CheckCircle2,
  AlertCircle,
  Paperclip,
  ShieldCheck,
  ArrowRight,
  Send,
  Sliders,
  LogIn,
  UserPlus,
} from 'lucide-react';
import { Button, Card, CardContent, Badge } from '@/components/common';
import { useAuth } from '@/hooks/useAuth';

export const HomePage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="space-y-20 py-8 md:py-16">
      {/* Hero Section */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
          <span>Official Campus Maintenance Portal</span>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Smart College Complaint Portal
          </h1>
          <p className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 dark:from-indigo-400 dark:to-blue-400">
            &ldquo;Report. Track. Resolve.&rdquo;
          </p>
        </div>

        <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
          An easy and transparent way for students to report college infrastructure and maintenance
          issues and track their resolution.
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
          {isAuthenticated && user ? (
            <Link to={user.role === 'admin' ? '/admin/dashboard' : user.role === 'staff' ? '/staff/dashboard' : '/student/dashboard'}>
              <Button size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Go to {user.role === 'admin' ? 'Admin Console' : user.role === 'staff' ? 'Staff Queue' : 'Student Dashboard'}
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/login">
                <Button size="lg" leftIcon={<LogIn className="w-4 h-4" />}>
                  Login
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="outline" size="lg" leftIcon={<UserPlus className="w-4 h-4" />}>
                  Register
                </Button>
              </Link>
            </>
          )}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center space-y-2 mb-12">
          <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Workflow Process
          </h2>
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            How It Works
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            From initial report to technician sign-off, experience full transparency at every phase.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Step 1 */}
          <Card hoverEffect className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/5 rounded-bl-3xl flex items-start justify-end p-3 text-lg font-black text-indigo-500/20">
              01
            </div>
            <CardContent className="p-6 space-y-3">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
                <Send className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Submit a complaint
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Log maintenance requests with category selection, room/lab location, and priority classification.
              </p>
            </CardContent>
          </Card>

          {/* Step 2 */}
          <Card hoverEffect className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-bl-3xl flex items-start justify-end p-3 text-lg font-black text-blue-500/20">
              02
            </div>
            <CardContent className="p-6 space-y-3">
              <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
                <Clock className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Track progress
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Watch status transitions in real time from administrative triage to on-site technician assignment.
              </p>
            </CardContent>
          </Card>

          {/* Step 3 */}
          <Card hoverEffect className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-bl-3xl flex items-start justify-end p-3 text-lg font-black text-amber-500/20">
              03
            </div>
            <CardContent className="p-6 space-y-3">
              <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
                <Bell className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Receive updates
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Get notifications on repairs, parts ordered, technician comments, and expected resolution time.
              </p>
            </CardContent>
          </Card>

          {/* Step 4 */}
          <Card hoverEffect className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-bl-3xl flex items-start justify-end p-3 text-lg font-black text-emerald-500/20">
              04
            </div>
            <CardContent className="p-6 space-y-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Get it resolved
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Issue marked resolved with complete audit history and technician sign-off notes recorded forever.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center space-y-2 mb-12">
          <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Platform Capabilities
          </h2>
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Engineered Features
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Everything needed to manage college facilities efficiently and maintain campus infrastructure.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <Card hoverEffect>
            <CardContent className="p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Complaint submission
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Intuitive reporting forms for hostel dorms, lecture theaters, science labs, libraries, and canteens.
              </p>
            </CardContent>
          </Card>

          {/* Feature 2 */}
          <Card hoverEffect>
            <CardContent className="p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Complaint tracking
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Unique ticket IDs, searchable lists, and an interactive audit stepper displaying the full lifecycle.
              </p>
            </CardContent>
          </Card>

          {/* Feature 3 */}
          <Card hoverEffect>
            <CardContent className="p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Sliders className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Priority management
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Granular priority tiers (Low, Medium, High, Critical) ensuring safety hazards receive immediate attention.
              </p>
            </CardContent>
          </Card>

          {/* Feature 4 */}
          <Card hoverEffect>
            <CardContent className="p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Paperclip className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Image attachments
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Attach photographic proof and equipment tags so technicians bring the exact replacement parts.
              </p>
            </CardContent>
          </Card>

          {/* Feature 5 */}
          <Card hoverEffect>
            <CardContent className="p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Status updates
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Color-coded status updates (Pending, Assigned, In Progress, Resolved, Rejected) with time-stamped notes.
              </p>
            </CardContent>
          </Card>

          {/* Feature 6 */}
          <Card hoverEffect>
            <CardContent className="p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Administrative management
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Comprehensive console for facilities managers to allocate staff, oversee SLAs, and analyze trends.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Design System Preview */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6">
        <Card className="border-indigo-100 dark:border-slate-800 bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-6 md:p-8 space-y-5">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Design System & Institutional Status Colors
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Consistent semantic tokens ensure clarity between pending, assigned, in-progress, and resolved items.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800 space-y-2.5">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Statuses:
                </span>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="pending" dot>Pending</Badge>
                  <Badge variant="assigned" dot>Assigned</Badge>
                  <Badge variant="in_progress" dot>In Progress</Badge>
                  <Badge variant="resolved" dot>Resolved</Badge>
                  <Badge variant="rejected" dot>Rejected</Badge>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800 space-y-2.5">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Priorities:
                </span>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="low" dot>Low</Badge>
                  <Badge variant="medium" dot>Medium</Badge>
                  <Badge variant="high" dot>High</Badge>
                  <Badge variant="critical" dot>Critical</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};
