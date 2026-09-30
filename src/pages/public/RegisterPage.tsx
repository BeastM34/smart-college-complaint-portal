import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Building2, UserPlus, Info } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Input, Select } from '@/components/common';
import { useToast } from '@/hooks/useToast';

export const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [studentId, setStudentId] = useState('');
  const [department, setDepartment] = useState('Computer Science & Engineering');
  const [loading, setLoading] = useState(false);

  const { info } = useToast();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      info('Student registration form ready for Phase 2 authentication integration.', 'Phase 1 Foundation');
      navigate('/login');
    }, 600);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Student Account Registration
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Create your campus profile to submit and monitor facility complaints
          </p>
        </div>

        <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 dark:bg-blue-950/40 dark:border-blue-900/60 flex items-start gap-2.5 text-xs text-blue-800 dark:text-blue-300">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
          <p>
            <strong>Phase 1 Scaffolding:</strong> Full student identity verification and registration workflow will be connected in Phase 2.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile Details</CardTitle>
            <CardDescription>
              Use your official institutional email to verify student status.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <Input
                label="Full Name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jordan Smith"
                leftIcon={<User className="w-4 h-4" />}
              />

              <Input
                label="Student ID / Roll Number"
                required
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g. STU2026-9021"
                leftIcon={<Building2 className="w-4 h-4" />}
              />

              <Select
                label="Department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                options={[
                  { value: 'Computer Science & Engineering', label: 'Computer Science & Engineering' },
                  { value: 'Electrical & Electronics', label: 'Electrical & Electronics' },
                  { value: 'Mechanical Engineering', label: 'Mechanical Engineering' },
                  { value: 'Civil & Environmental', label: 'Civil & Environmental' },
                  { value: 'Business Administration', label: 'Business Administration' },
                ]}
              />

              <Input
                label="College Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@campus.edu"
                leftIcon={<Mail className="w-4 h-4" />}
              />

              <Input
                label="Create Password"
                type="password"
                required
                placeholder="••••••••"
                leftIcon={<Lock className="w-4 h-4" />}
              />
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                isLoading={loading}
                leftIcon={<UserPlus className="w-4 h-4" />}
              >
                Create Student Account
              </Button>

              <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                Already registered?{' '}
                <Link
                  to="/login"
                  className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                >
                  Sign In
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};
