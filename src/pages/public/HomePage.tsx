import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Clock,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Building,
  Zap,
  Wrench,
  BookOpen,
} from 'lucide-react';
import { Button, Card, CardContent, Badge } from '@/components/common';
import { useAuth } from '@/hooks/useAuth';

export const HomePage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-16 py-8 md:py-16">
      {/* Hero Section */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>Phase 1 Architecture & Foundation Live</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
          Campus maintenance & issues,{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600 dark:from-indigo-400 dark:to-blue-400">
            resolved transparently.
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
          The Smart College Complaint Portal bridges the gap between students and campus facility
          administration. Submit hostel, lab, electrical, and infrastructure issues and track live
          status updates with complete visibility.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {user?.role === 'admin' ? (
            <Link to="/admin/dashboard">
              <Button size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Go to Admin Console
              </Button>
            </Link>
          ) : (
            <Link to="/student/complaints/new">
              <Button size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Submit a Complaint
              </Button>
            </Link>
          )}

          <Link to="/student/complaints">
            <Button variant="outline" size="lg">
              Track Complaints
            </Button>
          </Link>
        </div>
      </section>

      {/* Design System & Token Showcase */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6">
        <Card className="border-indigo-100 dark:border-slate-800 bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-6 md:p-8 space-y-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Visual Design Tokens & State Palettes
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Phase 1 design system establishes accessible status and priority colors matching institutional standards.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Status Colors */}
              <div className="space-y-3 p-4 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Complaint Statuses:
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="pending" dot>Pending (Amber)</Badge>
                  <Badge variant="assigned" dot>Assigned (Violet)</Badge>
                  <Badge variant="in_progress" dot>In Progress (Blue)</Badge>
                  <Badge variant="resolved" dot>Resolved (Emerald)</Badge>
                  <Badge variant="rejected" dot>Rejected (Rose)</Badge>
                </div>
              </div>

              {/* Priority Colors */}
              <div className="space-y-3 p-4 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Priority Levels:
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="low" dot>Low (Slate)</Badge>
                  <Badge variant="medium" dot>Medium (Blue)</Badge>
                  <Badge variant="high" dot>High (Amber)</Badge>
                  <Badge variant="critical" dot>Critical (Rose)</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Feature Highlights Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center space-y-2 mb-10">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Built for Modern Higher Education
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
            Engineered from ground up with clean service abstractions and reactive state architecture.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card hoverEffect>
            <CardContent className="p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Building className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Hostel & Infrastructure
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Log room maintenance, washroom sanitation, and building repairs with specific room coordinates.
              </p>
            </CardContent>
          </Card>

          <Card hoverEffect>
            <CardContent className="p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Electrical & HVAC
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Report classroom power trips, projector glitches, and AC cooling faults directly to technicians.
              </p>
            </CardContent>
          </Card>

          <Card hoverEffect>
            <CardContent className="p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Live Status Timeline
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Every ticket records a complete audit trail from initial submission to final staff sign-off.
              </p>
            </CardContent>
          </Card>

          <Card hoverEffect>
            <CardContent className="p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Admin Governance
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Centralized dashboard for department heads to allocate staff, track SLAs, and analyze trends.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};
