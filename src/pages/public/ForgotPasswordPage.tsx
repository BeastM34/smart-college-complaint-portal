import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Send, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Input } from '@/components/common';
import { useToast } from '@/hooks/useToast';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { success } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setError('Please enter your college email address.');
      return;
    }
    if (!emailRegex.test(email.trim())) {
      setError('Please provide a valid email format (e.g. user@college.edu).');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      success(`Password recovery link simulated for ${email}`, 'Email Dispatched');
    }, 700);
  };

  return (
    <div className="min-h-[82vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Sign In</span>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Reset Password</CardTitle>
            <CardDescription>
              Enter your college email address and we'll send a password recovery token.
            </CardDescription>
          </CardHeader>

          {submitted ? (
            <CardContent className="space-y-5 py-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Recovery Email Dispatched
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  We have simulated delivering a secure reset link to{' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {email}
                  </span>
                  .
                </p>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500 text-left mt-3">
                  <p className="font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                    Simulation Note:
                  </p>
                  <p>
                    In this demo environment, real emails are not sent. You can return to the login screen and use the one-click demo presets or your newly registered credentials.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Link to="/login" className="w-full">
                  <Button variant="primary" size="sm" className="w-full">
                    Return to Sign In
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSubmitted(false)}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Send to a different email
                </Button>
              </div>
            </CardContent>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {error && (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/60 dark:border-rose-900 dark:text-rose-200 flex items-start gap-2.5 text-xs animate-in fade-in"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                    <span>{error}</span>
                  </div>
                )}

                <Input
                  label="Registered College Email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  placeholder="student@college.edu"
                  leftIcon={<Mail className="w-4 h-4" />}
                />
              </CardContent>

              <CardFooter className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  isLoading={loading}
                  leftIcon={<Send className="w-4 h-4" />}
                >
                  Send Reset Link
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};
