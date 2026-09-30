import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Mail,
  Phone,
  Building2,
  Save,
  Lock,
  Eye,
  EyeOff,
  Bell,
  Moon,
  Sun,
  Laptop,
  CheckCircle2,
  Camera,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  Check,
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
  Textarea,
  Avatar,
  Badge,
} from '@/components/common';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { STORAGE_KEYS, getStorageItem, setStorageItem } from '@/utils/storage';
import type { UserPreferences } from '@/types';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=250',
];

const DEPARTMENTS = [
  'Computer Science & Engineering',
  'Electronics & Communication',
  'Mechanical Engineering',
  'Civil & Environmental Engineering',
  'Electrical & Electronics',
  'Information Technology',
  'Chemical Engineering',
  'Biotechnology',
  'Business Administration',
];

export const StudentProfilePage: React.FC = () => {
  const { user, updateProfile, changePassword } = useAuth();
  const { success, error: toastError } = useToast();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'preferences'>('profile');

  // Profile Form State
  const [name, setName] = useState(user?.name || 'Alex Johnson');
  const [phone, setPhone] = useState(user?.phone || '+1 (555) 234-5678');
  const [department, setDepartment] = useState(
    user?.department || 'Computer Science & Engineering'
  );
  const [bio, setBio] = useState(
    user?.bio || 'Undergraduate student and resident in Ramanujan Boys Hostel Block 4.'
  );
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || PRESET_AVATARS[0]);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  // Preferences State
  const [themePref, setThemePref] = useState<'light' | 'dark' | 'system'>(() => {
    return (getStorageItem<string>(STORAGE_KEYS.THEME, 'system') as 'light' | 'dark' | 'system') || 'system';
  });
  const [emailAlerts, setEmailAlerts] = useState(user?.preferences?.emailAlerts ?? true);
  const [statusChangeAlerts, setStatusChangeAlerts] = useState(
    user?.preferences?.statusChangeAlerts ?? true
  );
  const [assignmentAlerts, setAssignmentAlerts] = useState(
    user?.preferences?.assignmentAlerts ?? true
  );
  const [digestSummary, setDigestSummary] = useState(user?.preferences?.digestSummary ?? false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone(user.phone || '');
      setDepartment(user.department || 'Computer Science & Engineering');
      setBio(user.bio || '');
      if (user.avatarUrl) setAvatarUrl(user.avatarUrl);
      if (user.preferences) {
        if (user.preferences.theme) setThemePref(user.preferences.theme);
        if (user.preferences.emailAlerts !== undefined) setEmailAlerts(user.preferences.emailAlerts);
        if (user.preferences.statusChangeAlerts !== undefined)
          setStatusChangeAlerts(user.preferences.statusChangeAlerts);
        if (user.preferences.assignmentAlerts !== undefined)
          setAssignmentAlerts(user.preferences.assignmentAlerts);
        if (user.preferences.digestSummary !== undefined)
          setDigestSummary(user.preferences.digestSummary);
      }
    }
  }, [user]);

  // Handle Save Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        department: department.trim(),
        bio: bio.trim(),
        avatarUrl,
      });
      success('Student profile details updated successfully.', 'Profile Saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile';
      toastError(msg, 'Error');
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (!currentPassword) {
      errs.current = 'Current password is required';
    }
    if (!newPassword) {
      errs.new = 'New password is required';
    } else if (newPassword.length < 6) {
      errs.new = 'Password must be at least 6 characters long';
    } else if (newPassword === currentPassword) {
      errs.new = 'New password must be different from current password';
    }
    if (confirmPassword !== newPassword) {
      errs.confirm = 'Passwords do not match';
    }

    if (Object.keys(errs).length > 0) {
      setPasswordErrors(errs);
      return;
    }

    setPasswordErrors({});
    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      success('Your password has been changed successfully.', 'Password Updated');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to change password';
      toastError(msg, 'Password Change Failed');
    } finally {
      setChangingPassword(false);
    }
  };

  // Handle Save Preferences
  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    try {
      // Apply theme locally
      setStorageItem(STORAGE_KEYS.THEME, themePref);
      if (themePref === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (themePref === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', systemDark);
      }

      const updatedPrefs: UserPreferences = {
        theme: themePref,
        emailAlerts,
        statusChangeAlerts,
        assignmentAlerts,
        digestSummary,
      };

      await updateProfile({ preferences: updatedPrefs });
      success('Application and notification preferences saved.', 'Preferences Saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save preferences';
      toastError(msg, 'Error');
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Account Settings
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Manage your personal profile, student department information, login credentials, and notification preferences.
        </p>
      </div>

      {/* Profile Summary Card with Avatar Selector */}
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar with change button */}
            <div className="relative group shrink-0">
              <Avatar src={avatarUrl} name={name} size="xl" status="online" className="shadow-md" />
              <button
                type="button"
                onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                className="absolute -bottom-1 -right-1 p-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-transform hover:scale-105"
                title="Change Avatar"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Profile Info */}
            <div className="space-y-1.5 text-center sm:text-left flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                  {name}
                </h2>
                <Badge variant="student" size="sm">
                  Student
                </Badge>
                <Badge variant="default" size="sm">
                  {user?.year || '3rd Year'}
                </Badge>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center justify-center sm:justify-start gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                <span>{department}</span>
              </p>

              <p className="text-xs font-mono text-slate-400">
                {user?.email || 'student@college.edu'}
              </p>

              {bio && (
                <p className="text-xs text-slate-500 dark:text-slate-400 pt-1 italic line-clamp-2">
                  "{bio}"
                </p>
              )}
            </div>
          </div>

          {/* Preset Avatar Selection Grid */}
          {showAvatarPicker && (
            <div className="mt-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Choose an Avatar:
              </span>
              <div className="flex flex-wrap items-center gap-3">
                {PRESET_AVATARS.map((av, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setAvatarUrl(av);
                      setShowAvatarPicker(false);
                    }}
                    className={`relative rounded-full p-0.5 transition-transform hover:scale-110 ${
                      avatarUrl === av ? 'ring-2 ring-indigo-600 ring-offset-2' : ''
                    }`}
                  >
                    <img src={av} alt={`Avatar ${idx + 1}`} className="w-11 h-11 rounded-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'profile'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          Profile Details
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('password')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'password'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          Change Password
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preferences')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'preferences'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          Preferences
        </button>
      </div>

      {/* TAB 1: Profile Editing */}
      {activeTab === 'profile' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Personal Information</CardTitle>
            <CardDescription>
              Update your department designation, contact telephone, and personal biography.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSaveProfile}>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Full Name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  leftIcon={<UserIcon className="w-4 h-4 text-slate-400" />}
                />

                {/* Student ID (Read Only) */}
                <Input
                  label="Student ID (Read-only)"
                  disabled
                  value={user?.studentId || 'STU2024-8841'}
                  helperText="Official student ID is verified by Registrar and cannot be edited."
                  leftIcon={<ShieldCheck className="w-4 h-4 text-slate-400" />}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* College Email (Read Only) */}
                <Input
                  label="College Email (Read-only)"
                  disabled
                  value={user?.email || 'student@college.edu'}
                  helperText="Primary email used for college correspondence."
                  leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
                />

                {/* Mobile Phone (Editable) */}
                <Input
                  label="Mobile Phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 234-5678"
                  leftIcon={<Phone className="w-4 h-4 text-slate-400" />}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Academic Department
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  label="Academic Year"
                  disabled
                  value={user?.year || '3rd Year'}
                  helperText="Enrolled cohort status."
                />
              </div>

              {/* Bio (Editable) */}
              <div>
                <Textarea
                  label="Personal Bio / Campus Interests"
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell campus facility and support teams a bit about yourself or hostel accommodations..."
                />
              </div>
            </CardContent>

            <CardFooter className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={savingProfile}
                leftIcon={<Save className="w-4 h-4" />}
                className="font-semibold shadow-xs"
              >
                Save Profile
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* TAB 2: Change Password */}
      {activeTab === 'password' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Change Security Password</CardTitle>
            <CardDescription>
              Ensure your account is using a secure password of at least 6 characters.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleChangePassword}>
            <CardContent className="space-y-4 max-w-md">
              {/* Current Password */}
              <div className="relative">
                <Input
                  label="Current Password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (passwordErrors.current) setPasswordErrors((prev) => ({ ...prev, current: '' }));
                  }}
                  error={passwordErrors.current}
                  leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* New Password */}
              <div className="relative">
                <Input
                  label="New Password"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (passwordErrors.new) setPasswordErrors((prev) => ({ ...prev, new: '' }));
                  }}
                  error={passwordErrors.new}
                  helperText="Must be at least 6 characters."
                  leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Confirm Password */}
              <div>
                <Input
                  label="Confirm New Password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (passwordErrors.confirm) setPasswordErrors((prev) => ({ ...prev, confirm: '' }));
                  }}
                  error={passwordErrors.confirm}
                  leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
                />
              </div>
            </CardContent>

            <CardFooter className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={changingPassword}
                leftIcon={<Lock className="w-4 h-4" />}
                className="font-semibold shadow-xs"
              >
                Update Password
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* TAB 3: Preferences */}
      {activeTab === 'preferences' && (
        <div className="space-y-6">
          {/* Theme Preferences */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Theme & Display Appearance</CardTitle>
              <CardDescription>
                Customize how the Smart College Complaint Portal appears on your devices.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 max-w-md">
                <button
                  type="button"
                  onClick={() => setThemePref('light')}
                  className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 text-xs font-semibold transition-all ${
                    themePref === 'light'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900 dark:bg-indigo-950/60 dark:border-indigo-500 dark:text-indigo-200 shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300'
                  }`}
                >
                  <Sun className="w-5 h-5 text-amber-500" />
                  <span>Light Mode</span>
                </button>

                <button
                  type="button"
                  onClick={() => setThemePref('dark')}
                  className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 text-xs font-semibold transition-all ${
                    themePref === 'dark'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900 dark:bg-indigo-950/60 dark:border-indigo-500 dark:text-indigo-200 shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300'
                  }`}
                >
                  <Moon className="w-5 h-5 text-indigo-500" />
                  <span>Dark Mode</span>
                </button>

                <button
                  type="button"
                  onClick={() => setThemePref('system')}
                  className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 text-xs font-semibold transition-all ${
                    themePref === 'system'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900 dark:bg-indigo-950/60 dark:border-indigo-500 dark:text-indigo-200 shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300'
                  }`}
                >
                  <Laptop className="w-5 h-5 text-slate-500" />
                  <span>System Default</span>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Notification Preferences */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Notification Preferences</CardTitle>
              <CardDescription>
                Choose which events trigger alerts to your email and in-app notifications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
                      Email Notifications
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Receive an email whenever a maintenance technician takes action on your ticket.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailAlerts}
                    onChange={(e) => setEmailAlerts(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded-md focus:ring-indigo-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
                      Status Change Alerts
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Receive immediate in-app alerts when complaints transition from Pending to In Progress or Resolved.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={statusChangeAlerts}
                    onChange={(e) => setStatusChangeAlerts(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded-md focus:ring-indigo-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
                      Technician Assignment Alerts
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Notify me when a maintenance staff member or specialized technician is assigned to my ticket.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={assignmentAlerts}
                    onChange={(e) => setAssignmentAlerts(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded-md focus:ring-indigo-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
                      Weekly Activity Digest
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      A periodic overview of college maintenance resolution times and hostel facilities.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={digestSummary}
                    onChange={(e) => setDigestSummary(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded-md focus:ring-indigo-500"
                  />
                </label>
              </div>
            </CardContent>

            <CardFooter className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleSavePreferences}
                isLoading={savingPrefs}
                leftIcon={<Save className="w-4 h-4" />}
                className="font-semibold shadow-xs"
              >
                Save Preferences
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
};
