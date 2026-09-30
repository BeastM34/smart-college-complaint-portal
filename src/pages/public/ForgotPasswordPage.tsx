import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Send, CheckCircle2 } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Input } from '@/components/common';
import { useToast } from '@/hooks/useToast';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const { info } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      info('Password recovery link simulation dispatched.', 'Phase 1 Foundation');
    }, 600);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
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
            <CardContent className="space-y-4 py-6 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Recovery Instructions Sent
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  If an account exists for <strong>{email}</strong>, you will receive reset instructions shortly.
                </p>
              </div>
            </CardContent>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <Input
                  label="Registered Email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@campus.edu"
                  leftIcon={<Mail className="w-4 h-4" />}
                />
              </CardContent>

              <CardFooter>
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  isLoading={loading}
                  leftIcon={<Send className="w-4 h-4" />}
                >
                  Send Recovery Link
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};
