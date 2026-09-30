import React, { useEffect, useState } from 'react';
import { Settings, Save, ShieldAlert, Sliders, BellRing, Mail } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
} from '@/components/common';
import { settingsService } from '@/services/settingsService';
import { useToast } from '@/hooks/useToast';
import type { SystemSettings } from '@/types';

export const AdminSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { success } = useToast();

  useEffect(() => {
    settingsService
      .getSettings()
      .then((data) => setSettings(data))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      await settingsService.updateSettings(settings);
      success('System settings updated successfully.', 'Settings Saved');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Portal & System Settings
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Configure institutional preferences, SLA policies, and contact information.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* General Institutional Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <CardTitle>Institutional Identity</CardTitle>
            </div>
            <CardDescription>
              Organization name and academic year displayed across receipts and reports.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Portal Title"
                value={settings.portalName}
                onChange={(e) => setSettings({ ...settings, portalName: e.target.value })}
              />
              <Input
                label="Academic Year"
                value={settings.academicYear}
                onChange={(e) => setSettings({ ...settings, academicYear: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Support Contact Email"
                type="email"
                value={settings.supportEmail}
                onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
              />
              <Input
                label="Support Helpline Phone"
                value={settings.supportPhone}
                onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Feature Toggles */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <CardTitle>Automated Rules & Workflows</CardTitle>
            </div>
            <CardDescription>
              Toggle system-wide automated assignments and notifications.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Allow Student Self-Registration
                </p>
                <p className="text-[11px] text-slate-500">
                  Permit students to register accounts using their @campus.edu credentials
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.allowStudentRegistration}
                onChange={(e) =>
                  setSettings({ ...settings, allowStudentRegistration: e.target.checked })
                }
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Automated Ticket Assignment
                </p>
                <p className="text-[11px] text-slate-500">
                  Auto-dispatch tickets to on-duty staff based on category rules
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoAssignComplaints}
                onChange={(e) =>
                  setSettings({ ...settings, autoAssignComplaints: e.target.checked })
                }
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Email Dispatch Notifications
                </p>
                <p className="text-[11px] text-slate-500">
                  Dispatch email notifications to students upon status transitions
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={(e) =>
                  setSettings({ ...settings, emailNotifications: e.target.checked })
                }
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={saving}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save System Settings
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
};
