import React, { useState } from 'react';
import {
  User as UserIcon,
  Mail,
  Building,
  Briefcase,
  Phone,
  Shield,
  Palette,
  CheckCircle2,
  Calendar,
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
  Badge,
  Avatar,
} from '@/components/common';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { userService } from '@/services/userService';

export const StaffProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { success, error: toastError } = useToast();

  const [phone, setPhone] = useState(user?.phone || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await userService.updateProfile(user.id, {
        phone: phone.trim(),
        bio: bio.trim(),
      });
      success('Technician profile updated successfully.', 'Profile Saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile';
      toastError(msg, 'Update Error');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page Title */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Staff Profile & Preferences
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          View your staff credentials, assignment department, and display preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Account Card */}
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardContent className="p-6 text-center space-y-4">
              <Avatar
                src={user.avatarUrl}
                name={user.name}
                size="lg"
                status="online"
                className="mx-auto"
              />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {user.name}
                </h3>
                <p className="text-xs text-slate-400 truncate">{user.email}</p>
                <div className="pt-1">
                  <Badge variant="staff" size="sm" dot>
                    Staff Technician
                  </Badge>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 text-left text-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span>Department</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {user.department || 'Maintenance'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Designation</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {user.designation || 'Technician'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Account ID</span>
                  <span className="font-mono text-slate-600 dark:text-slate-400">
                    {user.id}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Theme Preference Card */}
          <Card>
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-sm flex items-center gap-2">
                <Palette className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Interface Theme</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`p-3 rounded-xl border text-xs font-medium text-center transition-all cursor-pointer ${
                    theme === 'light'
                      ? 'border-indigo-600 bg-indigo-50/60 text-indigo-700 font-semibold shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  ☀️ Light Mode
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`p-3 rounded-xl border text-xs font-medium text-center transition-all cursor-pointer ${
                    theme === 'dark'
                      ? 'border-indigo-500 bg-indigo-950/60 text-indigo-300 font-semibold shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  🌙 Dark Mode
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Editable Profile Details */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle>Technician Information</CardTitle>
              <CardDescription>
                Primary contact details and technical bio visible in work order logs.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSaveProfile}>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Full Name"
                    value={user.name}
                    disabled
                    helperText="Official university account name (Read-only)"
                    leftIcon={<UserIcon className="w-4 h-4" />}
                  />
                  <Input
                    label="College Email"
                    value={user.email}
                    disabled
                    helperText="Official email used for authentication"
                    leftIcon={<Mail className="w-4 h-4" />}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Assigned Department"
                    value={user.department || 'Facilities & Maintenance'}
                    disabled
                    leftIcon={<Building className="w-4 h-4" />}
                  />
                  <Input
                    label="Staff Role"
                    value="Facility / Maintenance Staff"
                    disabled
                    leftIcon={<Briefcase className="w-4 h-4" />}
                  />
                </div>

                <Input
                  label="Contact Phone"
                  placeholder="+1 (555) 000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  leftIcon={<Phone className="w-4 h-4" />}
                  helperText="Emergency direct number for high priority dispatches"
                />

                <Textarea
                  label="Technician Bio / Specialization"
                  placeholder="e.g., Licensed electrical technician with 5+ years experience in campus HVAC and wiring..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                />
              </CardContent>

              <CardFooter className="flex justify-end p-6 pt-0">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={saving}
                >
                  Save Changes
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};
