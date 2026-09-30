import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, LogIn, Sparkles, GraduationCap } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Input } from '@/components/common';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import type { Role } from '@/types';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('alex.johnson@campus.edu');
  const [password, setPassword] = useState('password123');
  const [role, setRole] = useState<Role>('student');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const { success } = useToast();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, role);
      success(`Welcome back, ${user.name}!`, 'Signed In');
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/student/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (demoRole: Role, demoEmail: string) => {
    setEmail(demoEmail);
    setRole(demoRole);
    setLoading(true);
    try {
      const user = await login(demoEmail, demoRole);
      success(`Logged in as ${user.name} (${demoRole.toUpperCase()})`, 'Demo Access');
      navigate(demoRole === 'admin' ? '/admin/dashboard' : '/student/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 mb-2">
            <GraduationCap className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Welcome to SmartCampus
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sign in to submit complaints or access administrative dashboards
          </p>
        </div>

        {/* Quick Demo Login Preset Buttons */}
        <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-900 dark:text-indigo-300">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Phase 1 Quick Demo Presets:</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickDemo('student', 'alex.johnson@campus.edu')}
              className="bg-white dark:bg-slate-900 text-xs"
            >
              Demo Student
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickDemo('admin', 'admin.connor@campus.edu')}
              className="bg-white dark:bg-slate-900 text-xs"
            >
              Demo Admin
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account Credentials</CardTitle>
            <CardDescription>
              Enter your college email address and password to continue.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
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
                label="Password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                leftIcon={<Lock className="w-4 h-4" />}
              />

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700"
                  />
                  <span>Remember me</span>
                </label>
                <Link
                  to="/forgot-password"
                  className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                >
                  Forgot password?
                </Link>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                isLoading={loading}
                leftIcon={<LogIn className="w-4 h-4" />}
              >
                Sign In to Portal
              </Button>

              <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                New student?{' '}
                <Link
                  to="/register"
                  className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                >
                  Register here
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};
