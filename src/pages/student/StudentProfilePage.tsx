import React, { useState } from 'react';
import { User as UserIcon, Mail, Phone, Building2, Save } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Avatar,
  Badge,
} from '@/components/common';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { userService } from '@/services/userService';

export const StudentProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { success } = useToast();

  const [name, setName] = useState(user?.name || 'Alex Johnson');
  const [phone, setPhone] = useState(user?.phone || '+1 (555) 234-5678');
  const [department, setDepartment] = useState(user?.department || 'Computer Science & Engineering');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await userService.updateProfile(user.id, {
        name,
        phone,
        department,
      });
      success('Profile details updated successfully.', 'Profile Saved');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Student Profile
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Manage your personal information, department designation, and contact details.
        </p>
      </div>

      {/* Profile Overview Card */}
      <Card>
        <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-6">
          <Avatar
            src={user?.avatarUrl}
            name={user?.name || name}
            size="xl"
            status="online"
          />
          <div className="space-y-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {user?.name || name}
              </h3>
              <Badge variant="student" size="sm">
                Student Account
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ID: {user?.studentId || 'STU2024-8841'} • {user?.department || department}
            </p>
            <p className="text-xs font-mono text-slate-400">
              {user?.email || 'alex.johnson@campus.edu'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle>Contact & Department Details</CardTitle>
          <CardDescription>
            These details are attached to your submitted complaints for facility staff follow-ups.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSave}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                leftIcon={<UserIcon className="w-4 h-4" />}
              />

              <Input
                label="Student ID"
                disabled
                value={user?.studentId || 'STU2024-8841'}
                helperText="Student ID is managed by the Registrar."
                leftIcon={<Building2 className="w-4 h-4" />}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="College Email"
                disabled
                value={user?.email || 'alex.johnson@campus.edu'}
                helperText="Primary email cannot be changed."
                leftIcon={<Mail className="w-4 h-4" />}
              />

              <Input
                label="Mobile Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                leftIcon={<Phone className="w-4 h-4" />}
              />
            </div>

            <Input
              label="Academic Department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </CardContent>

          <CardFooter className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={saving}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save Changes
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};
