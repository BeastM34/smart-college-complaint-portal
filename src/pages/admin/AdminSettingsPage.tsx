import React, { useEffect, useState } from 'react';
import {
  Settings,
  Save,
  ShieldAlert,
  Sliders,
  BellRing,
  Mail,
  RotateCcw,
  FileCheck2,
  Users,
  AlertTriangle,
  CheckCircle2,
  Database,
  Lock,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Select,
  Modal,
  SkeletonLoader,
} from '@/components/common';
import { settingsService } from '@/services/settingsService';
import { useToast } from '@/hooks/useToast';
import type { SystemSettings, Priority } from '@/types';

export const AdminSettingsPage: React.FC = () => {
  const { success, error: toastError } = useToast();

  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Reset Demo Modal State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await settingsService.getSettings();
      setSettings(data);
    } catch (err) {
      console.error('Failed to load system settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    try {
      await settingsService.updateSettings(settings);
      success('System settings saved and applied successfully.', 'Settings Saved');
    } catch (err) {
      toastError('Failed to save settings', 'Error');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmReset = async () => {
    setIsResetting(true);
    try {
      await settingsService.resetDemoData();
      success('All demo data (Complaints, Users, Notifications, Categories, Settings) restored to pristine state.', 'Demo Data Reset');
      setResetModalOpen(false);
      // Wait a moment then reload to apply fresh storage state everywhere
      setTimeout(() => {
        window.location.reload();
      }, 750);
    } catch (err) {
      toastError('Failed to reset demo data', 'Error');
      console.error(err);
      setIsResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <SkeletonLoader variant="text" width={220} height={24} />
        <SkeletonLoader variant="card" height={240} />
        <SkeletonLoader variant="card" height={240} />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            System & Portal Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Configure institutional policies, complaint workflow parameters, alert channels, and demonstration data.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleSave}
          isLoading={saving}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold self-start sm:self-auto"
          leftIcon={<Save className="w-4 h-4" />}
        >
          Save All Changes
        </Button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 1: GENERAL */}
        <Card>
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <CardTitle className="text-base font-bold">1. General Information</CardTitle>
            </div>
            <CardDescription className="text-xs">
              College identity, academic calendar year, and institutional support lines
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Portal Name
                </label>
                <Input
                  value={settings.portalName}
                  onChange={(e) => setSettings({ ...settings, portalName: e.target.value })}
                  placeholder="Smart College Complaint Portal"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Academic Year
                </label>
                <Input
                  value={settings.academicYear}
                  onChange={(e) => setSettings({ ...settings, academicYear: e.target.value })}
                  placeholder="2026-2027"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Support Contact Email
                </label>
                <Input
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                  placeholder="helpdesk@college.edu"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Support Helpline Phone
                </label>
                <Input
                  value={settings.supportPhone}
                  onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })}
                  placeholder="+1 (800) 555-CAMPUS"
                  required
                />
              </div>
            </div>

            {/* Maintenance Mode Toggle */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.maintenanceMode}
                  onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                  className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                    Maintenance Mode
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    When active, display a maintenance banner and restrict new student complaint submissions.
                  </span>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 2: COMPLAINT SETTINGS */}
        <Card>
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <CardTitle className="text-base font-bold">2. Complaint Settings</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Workflow policies, default urgency levels, and student submission rules
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {/* Default Priority */}
            <div className="max-w-xs">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Default Priority for New Complaints
              </label>
              <Select
                value={settings.defaultPriority || 'medium'}
                onChange={(e) =>
                  setSettings({ ...settings, defaultPriority: e.target.value as Priority })
                }
                options={[
                  { value: 'low', label: 'Low — Standard maintenance' },
                  { value: 'medium', label: 'Medium — Normal operations' },
                  { value: 'high', label: 'High — Significant issue' },
                  { value: 'critical', label: 'Critical — Emergency outage' },
                ]}
              />
            </div>

            {/* Attachment Limits */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Max Attachments Per Complaint
                </label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={settings.maxAttachmentsPerComplaint ?? 3}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      maxAttachmentsPerComplaint: Math.max(1, parseInt(e.target.value) || 1),
                    })
                  }
                  helperText="Maximum photo attachments permitted per single ticket submission (1-10)."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Max Attachment Size (MB)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={25}
                  value={settings.maxAttachmentSizeMB ?? 5}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      maxAttachmentSizeMB: Math.max(1, parseInt(e.target.value) || 1),
                    })
                  }
                  helperText="Maximum allowable image upload file size in megabytes (1-25 MB)."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {/* Auto assignment */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoAssignComplaints}
                    onChange={(e) =>
                      setSettings({ ...settings, autoAssignComplaints: e.target.checked })
                    }
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                      Auto Assignment
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      Automatically route incoming tickets to category technician.
                    </span>
                  </div>
                </label>
              </div>

              {/* Allow Reopening */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.allowReopening}
                    onChange={(e) =>
                      setSettings({ ...settings, allowReopening: e.target.checked })
                    }
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                      Allow Reopening
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      Permit students to reopen resolved/rejected tickets with a reason.
                    </span>
                  </div>
                </label>
              </div>

              {/* Allow Anonymous Complaints */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.allowAnonymousComplaints}
                    onChange={(e) =>
                      setSettings({ ...settings, allowAnonymousComplaints: e.target.checked })
                    }
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                      Allow Anonymous
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      Permit students to submit safety issues confidentially.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 3: NOTIFICATION SETTINGS */}
        <Card>
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <BellRing className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <CardTitle className="text-base font-bold">3. Notification Settings</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Delivery channels, student alerts, and external communication gateways
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            {/* Student Notifications */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.studentNotifications}
                  onChange={(e) =>
                    setSettings({ ...settings, studentNotifications: e.target.checked })
                  }
                  className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Student In-Portal Notifications
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      Active In-App Channel
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    Deliver real-time bell badge updates and ticket lifecycle events directly into student portals. Disabling suppresses routine student alerts while keeping admin alerts operational.
                  </span>
                </div>
              </label>
            </div>

            {/* Email Notifications */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={(e) =>
                    setSettings({ ...settings, emailNotifications: e.target.checked })
                  }
                  className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Email Notifications
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                      Simulated / Not Connected
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    Email delivery is currently simulated and not connected to an external SMTP host. Outgoing emails cannot be dispatched; all communications remain in-app.
                  </span>
                </div>
              </label>
            </div>

            {/* SMS Notifications */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.smsNotifications ?? false}
                  onChange={(e) =>
                    setSettings({ ...settings, smsNotifications: e.target.checked })
                  }
                  className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      SMS Notifications
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400">
                      Not Configured
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    SMS telephony gateway is not configured. Outgoing text messages will not be dispatched.
                  </span>
                </div>
              </label>
            </div>

            {/* Push Notifications */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.pushNotifications}
                  onChange={(e) =>
                    setSettings({ ...settings, pushNotifications: e.target.checked })
                  }
                  className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Push Notifications
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                      Not Configured / In-App Only
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    Web push service workers and VAPID credentials are not configured. Real-time notifications operate exclusively via in-app alerts.
                  </span>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 4: USER SETTINGS */}
        <Card>
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <CardTitle className="text-base font-bold">4. User Settings</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Account provisioning and student self-service onboarding
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.allowStudentRegistration}
                  onChange={(e) =>
                    setSettings({ ...settings, allowStudentRegistration: e.target.checked })
                  }
                  className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                    Allow Student Registration
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    Permit new students to register accounts using their university credentials on the public signup screen.
                  </span>
                </div>
              </label>
            </div>
          </CardContent>
          <CardFooter className="flex items-center justify-end p-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save System Settings
            </Button>
          </CardFooter>
        </Card>
      </form>

      {/* SECTION 5: RESET DEMO DATA (CRITICAL DEMONSTRATION TOOL) */}
      <Card className="border-rose-200 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/10">
        <CardHeader className="pb-3 border-b border-rose-100 dark:border-rose-900/30">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            <CardTitle className="text-base font-bold text-rose-900 dark:text-rose-200">
              Reset Demo Data
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-rose-700/80 dark:text-rose-300/70">
            Restore all portal complaints, user accounts, categories, notifications, and settings back to initial mock values.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <p className="font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              Repeated Project Demonstration Reset
            </p>
            <p className="leading-relaxed">
              Clicking <strong>Reset Demo Data</strong> will overwrite any changes made during this session and repopulate the environment with:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-slate-400 pl-1">
              <li>20+ original campus complaints across all buildings and priorities</li>
              <li>10 student profiles and 5 technicians</li>
              <li>Default facility categories & SLAs</li>
              <li>Initial notifications and system settings</li>
            </ul>
          </div>

          <Button
            type="button"
            variant="danger"
            size="md"
            onClick={() => setResetModalOpen(true)}
            className="font-semibold shadow-xs"
            leftIcon={<RotateCcw className="w-4 h-4" />}
          >
            Reset Demo Data to Initial State
          </Button>
        </CardContent>
      </Card>

      {/* CONFIRMATION MODAL: RESET DEMO DATA */}
      <Modal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title={
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-5 h-5" />
            <span>Confirm Demo Data Reset</span>
          </div>
        }
        description="This will restore all portal records back to initial mock values."
      >
        <div className="space-y-4 pt-2 text-xs text-slate-600 dark:text-slate-300">
          <p>
            Are you sure you want to proceed with resetting all demonstration data?
          </p>
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200">
            All submitted complaints, status transitions, staff allocations, and comments made during this session will be reverted to the factory mock state.
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setResetModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={isResetting}
              onClick={handleConfirmReset}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Yes, Reset Everything
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
