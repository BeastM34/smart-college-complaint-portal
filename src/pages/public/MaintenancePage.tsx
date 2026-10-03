import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wrench, Shield, Mail, Phone, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { Button, Card, CardContent } from '@/components/common';
import { settingsService } from '@/services/settingsService';
import { useAuth } from '@/hooks/useAuth';
import type { SystemSettings } from '@/types';

export const MaintenancePage: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings>(() => settingsService.getSettingsSync());
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    settingsService.getSettings().then(setSettings);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-800 dark:text-slate-100">
      <div className="w-full max-w-xl text-center space-y-6">
        {/* Animated Maintenance Icon */}
        <div className="inline-flex p-4 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 mb-2">
          <Wrench className="w-12 h-12 animate-pulse" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            System Maintenance in Progress
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            {settings.portalName} student services are temporarily undergoing scheduled maintenance. Student complaint tracking and submission are temporarily paused.
          </p>
        </div>

        {/* Status card */}
        <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 text-left">
          <CardContent className="p-4 sm:p-5 space-y-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>What this means:</span>
            </div>
            <ul className="list-disc list-inside space-y-1.5 text-slate-600 dark:text-slate-300 pl-1">
              <li>Student complaint creation, edits, and status tracking are temporarily paused.</li>
              <li>Existing complaints and student profiles remain secure and unaffected.</li>
              <li>Normal student portal access will resume immediately upon maintenance completion.</li>
            </ul>
          </CardContent>
        </Card>

        {/* Admin Callout */}
        {isAdmin ? (
          <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 text-indigo-900 dark:text-indigo-200 text-xs sm:text-sm text-left flex items-start gap-3">
            <Shield className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-2 flex-1">
              <p className="font-semibold">Administrator Access Active</p>
              <p className="text-xs text-indigo-700 dark:text-indigo-300">
                You are authenticated as an administrator. You retain full administrative privileges and can disable maintenance mode in Portal Settings.
              </p>
              <Link to="/admin/settings">
                <Button size="sm" variant="primary" className="mt-1 bg-indigo-600 hover:bg-indigo-700 text-white">
                  Manage Settings <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Check Again
            </Button>
            <Link to="/login">
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Shield className="w-3.5 h-3.5" />}
                className="text-slate-600 dark:text-slate-400"
              >
                Staff / Admin Login
              </Button>
            </Link>
          </div>
        )}

        {/* Support contacts */}
        <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-slate-400" />
            <a href={`mailto:${settings.supportEmail}`} className="hover:underline">
              {settings.supportEmail}
            </a>
          </span>
          <span className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span>{settings.supportPhone}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
