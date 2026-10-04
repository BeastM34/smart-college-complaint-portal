import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, LogIn, Sparkles, GraduationCap, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Input } from '@/components/common';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { authService } from '@/services/authService';
import { settingsService } from '@/services/settingsService';

export const LoginPage: React.FC = () => {
  const [registrationAllowed, setRegistrationAllowed] = useState<boolean>(() =>
    settingsService.getSettingsSync().allowStudentRegistration
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { login, user, isAuthenticated } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const getRoleDestination = (role: string) => {
    if (role === 'admin') return '/admin/dashboard';
    if (role === 'staff') return '/staff/dashboard';
    return '/student/dashboard';
  };

  useEffect(() => {
    if (location.state?.registeredEmail) {
      setEmail(location.state.registeredEmail);
    }
    if (location.state?.registrationSuccess) {
      setSuccessMessage('Registration successful! Please enter your password to sign in.');
    }
    if (location.state?.deactivated) {
      setErrorMessage('Your session was ended because this account has been deactivated.');
    }
    settingsService.getSettings().then((s) => {
      setRegistrationAllowed(s.allowStudentRegistration);
    });
  }, [location.state]);

  // If already authenticated and account is active, redirect to appropriate dashboard
  useEffect(() => {
    if (isAuthenticated && user && (user.status || 'active') !== 'inactive') {
      const live = authService.getLiveUser(user.id);
      if (live && (live.status || 'active') !== 'inactive') {
        navigate(getRoleDestination(user.role), { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Please enter your college email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const loggedUser = await login(email, password, rememberMe);
      success(`Welcome back, ${loggedUser.name}!`, 'Signed In');
      
      const destination = location.state?.from?.pathname || getRoleDestination(loggedUser.role);
      navigate(destination, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials. Please verify your email and password.';
      setErrorMessage(msg);
      toastError(msg, 'Authentication Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string, demoPass: string, roleName: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage(null);
    setLoading(true);

    try {
      const loggedUser = await login(demoEmail, demoPass, true);
      success(`Logged in as ${loggedUser.name} (${roleName})`, 'Demo Access');
      navigate(getRoleDestination(loggedUser.role), { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to authenticate demo user.';
      setErrorMessage(msg);
      toastError(msg, 'Demo Access Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[82vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 mb-1">
            <GraduationCap className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Sign In to SmartCampus
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enter your college credentials to submit issues or manage facility queues
          </p>
        </div>

        {/* Demo Login Buttons Panel */}
        <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-900/80 space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-900 dark:text-indigo-200">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Instant Demo Login</span>
            </div>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
              Click to sign in instantly
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              isLoading={loading}
              onClick={() => handleDemoLogin('student@college.edu', 'student123', 'Student')}
              className="bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 text-xs py-2 flex flex-col items-center justify-center h-auto gap-0.5"
            >
              <span className="font-semibold text-indigo-950 dark:text-indigo-100 text-[11px]">Student</span>
              <span className="text-[9px] text-slate-400 font-mono truncate max-w-full">student@college</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              isLoading={loading}
              onClick={() => handleDemoLogin('staff@college.edu', 'staff123', 'Staff')}
              className="bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 text-xs py-2 flex flex-col items-center justify-center h-auto gap-0.5"
            >
              <span className="font-semibold text-indigo-950 dark:text-indigo-100 text-[11px]">Staff</span>
              <span className="text-[9px] text-slate-400 font-mono truncate max-w-full">staff@college</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              isLoading={loading}
              onClick={() => handleDemoLogin('admin@college.edu', 'admin123', 'Administrator')}
              className="bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 text-xs py-2 flex flex-col items-center justify-center h-auto gap-0.5"
            >
              <span className="font-semibold text-indigo-950 dark:text-indigo-100 text-[11px]">Admin</span>
              <span className="text-[9px] text-slate-400 font-mono truncate max-w-full">admin@college</span>
            </Button>
          </div>
        </div>

        {/* Login Form Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Account Credentials</CardTitle>
            <CardDescription>
              Sign in with your registered college email and password.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              {successMessage && (
                <div
                  role="status"
                  className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-900 dark:text-emerald-200 flex items-start gap-2.5 text-xs animate-in fade-in"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{successMessage}</span>
                </div>
              )}

              {errorMessage && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/60 dark:border-rose-900 dark:text-rose-200 flex items-start gap-2.5 text-xs animate-in fade-in"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <Input
                label="College Email"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="user@college.edu"
                leftIcon={<Mail className="w-4 h-4" />}
              />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>

                <div className="relative flex items-center">
                  <div className="absolute left-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>

                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMessage(null);
                    }}
                    placeholder="••••••••"
                    className="flex h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-10 py-1.5 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400 select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 cursor-pointer"
                  />
                  <span>Remember me for 30 days</span>
                </label>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 pt-2">
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                isLoading={loading}
                leftIcon={<LogIn className="w-4 h-4" />}
              >
                Sign In
              </Button>

              <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                New student without an account?{' '}
                {registrationAllowed ? (
                  <Link
                    to="/register"
                    className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                  >
                    Register here
                  </Link>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 italic">
                    (Registration currently closed)
                  </span>
                )}
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};
