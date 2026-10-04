import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User as UserIcon,
  Mail,
  Lock,
  Building2,
  Calendar,
  Phone,
  UserPlus,
  Eye,
  EyeOff,
  AlertCircle,
  GraduationCap,
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
} from '@/components/common';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { settingsService } from '@/services/settingsService';

export const RegisterPage: React.FC = () => {
  const [registrationAllowed, setRegistrationAllowed] = useState<boolean>(() =>
    settingsService.getSettingsSync().allowStudentRegistration
  );
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('Computer Science & Engineering');
  const [year, setYear] = useState('1st Year');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const { register, user, isAuthenticated } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    settingsService.getSettings().then((s) => {
      setRegistrationAllowed(s.allowStudentRegistration);
    });
  }, []);

  // If already logged in, redirect to respective dashboard
  useEffect(() => {
    if (isAuthenticated && user) {
      const dest =
        user.role === 'admin'
          ? '/admin/dashboard'
          : user.role === 'staff'
          ? '/staff/dashboard'
          : '/student/dashboard';
      navigate(dest, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};

    if (!name.trim()) errs.name = 'Full name is required.';
    if (!studentId.trim()) errs.studentId = 'Student ID / Roll number is required.';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      errs.email = 'College email address is required.';
    } else if (!emailRegex.test(email.trim())) {
      errs.email = 'Please provide a valid email format (e.g. name@college.edu).';
    }

    if (!phone.trim()) {
      errs.phone = 'Mobile contact number is required.';
    } else if (phone.trim().replace(/\D/g, '').length < 7) {
      errs.phone = 'Please enter a valid phone number with at least 7 digits.';
    }

    if (!password) {
      errs.password = 'Password is required.';
    } else if (password.length < 6) {
      errs.password = 'Password must be at least 6 characters long.';
    }

    if (!confirmPassword) {
      errs.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match.';
    }

    if (!termsAccepted) {
      errs.terms = 'You must agree to the college portal terms of service.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const newUser = await register({
        name,
        studentId,
        email,
        department,
        year,
        phone,
        password,
        confirmPassword,
        termsAccepted,
      });

      success(
        `Account created successfully for ${newUser.name}. Please sign in with your credentials.`,
        'Registration Complete'
      );
      navigate('/login', {
        replace: true,
        state: {
          registeredEmail: newUser.email,
          registrationSuccess: true,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setGeneralError(msg);
      toastError(msg, 'Registration Error');
    } finally {
      setLoading(false);
    }
  };

  if (!registrationAllowed) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
            <UserPlus className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Student Registration Closed
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              New student self-registration is currently paused by institutional administration.
            </p>
          </div>
          <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/20 text-left">
            <CardContent className="p-4 sm:p-5 space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              <p>
                If you already have an active student account, you can sign in directly with your university email.
              </p>
              <p>
                If you need a new account created or roll number verified, please contact the campus administrative helpdesk.
              </p>
            </CardContent>
          </Card>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/login" className="w-full sm:w-auto">
              <Button variant="primary" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                Back to Sign In
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 mb-1">
            <GraduationCap className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Student Account Registration
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Create your student profile to report hostel, electrical, and campus facilities complaints
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Academic & Identity Details</CardTitle>
            <CardDescription>
              Only currently enrolled students can register through this portal.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleRegister}>
            <CardContent className="space-y-4">
              {generalError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/60 dark:border-rose-900 dark:text-rose-200 flex items-start gap-2.5 text-xs animate-in fade-in"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                  <span>{generalError}</span>
                </div>
              )}

              {/* Full Name & Student ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Full Name"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                  }}
                  error={errors.name}
                  placeholder="e.g. Jordan Smith"
                  leftIcon={<UserIcon className="w-4 h-4" />}
                />

                <Input
                  label="Student ID / Roll No."
                  required
                  value={studentId}
                  onChange={(e) => {
                    setStudentId(e.target.value);
                    if (errors.studentId) setErrors((prev) => ({ ...prev, studentId: '' }));
                  }}
                  error={errors.studentId}
                  placeholder="e.g. STU2026-9021"
                  leftIcon={<Building2 className="w-4 h-4" />}
                />
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="College Email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                  }}
                  error={errors.email}
                  placeholder="student@college.edu"
                  leftIcon={<Mail className="w-4 h-4" />}
                />

                <Input
                  label="Mobile Contact"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                  }}
                  error={errors.phone}
                  placeholder="+1 (555) 000-0000"
                  leftIcon={<Phone className="w-4 h-4" />}
                />
              </div>

              {/* Department & Year */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    { value: 'Biotechnology & Life Sciences', label: 'Biotechnology & Life Sciences' },
                  ]}
                />

                <Select
                  label="Academic Year"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  options={[
                    { value: '1st Year', label: '1st Year (Freshman)' },
                    { value: '2nd Year', label: '2nd Year (Sophomore)' },
                    { value: '3rd Year', label: '3rd Year (Junior)' },
                    { value: '4th Year', label: '4th Year (Senior)' },
                    { value: 'Graduate / Postgrad', label: 'Graduate / Postgrad' },
                  ]}
                />
              </div>

              {/* Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="reg-password"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Create Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                      }}
                      placeholder="Min. 6 chars"
                      className="flex h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-10 py-1.5 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-rose-500 mt-1">{errors.password}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="reg-confirm-password"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Confirm Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="reg-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                      }}
                      placeholder="Repeat password"
                      className="flex h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-10 py-1.5 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-xs text-rose-500 mt-1">{errors.confirmPassword}</p>
                  )}
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600 dark:text-slate-400 select-none">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => {
                      setTermsAccepted(e.target.checked);
                      if (errors.terms) setErrors((prev) => ({ ...prev, terms: '' }));
                    }}
                    className="w-4 h-4 mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 cursor-pointer"
                  />
                  <span>
                    I confirm that I am an actively enrolled student and agree to the{' '}
                    <span className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
                      Campus Portal Code of Conduct
                    </span>
                    .
                  </span>
                </label>
                {errors.terms && (
                  <p className="text-xs text-rose-500 mt-1 pl-6.5">{errors.terms}</p>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 pt-2">
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
