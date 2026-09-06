'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authApi, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Mail,
  ArrowRight,
  Activity,
  ShieldCheck,
  Send,
} from 'lucide-react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = React.useState<'IDLE' | 'VERIFYING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [message, setMessage] = React.useState<string>('');
  const [resendEmail, setResendEmail] = React.useState('');
  const [resendSuccess, setResendSuccess] = React.useState<string | null>(null);
  const [resendError, setResendError] = React.useState<string | null>(null);
  const [isResending, setIsResending] = React.useState(false);

  const verifyToken = React.useCallback(async (tok: string) => {
    setStatus('VERIFYING');
    setMessage('');
    try {
      const res = await authApi.verifyEmail(tok);
      setStatus('SUCCESS');
      setMessage(res.message || 'Your email address has been certified and verified successfully.');
    } catch (err) {
      setStatus('ERROR');
      setMessage(getErrorMessage(err));
    }
  }, []);

  React.useEffect(() => {
    if (token) {
      verifyToken(token);
    } else {
      setStatus('ERROR');
      setMessage('Missing or invalid verification link. Please check your email or request a new verification link below.');
    }
  }, [token, verifyToken]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;

    setIsResending(true);
    setResendSuccess(null);
    setResendError(null);

    try {
      const res = await authApi.resendVerification(resendEmail.trim());
      setResendSuccess(res.message || 'If an account exists, a new verification link has been dispatched.');
      setResendEmail('');
    } catch (err) {
      setResendError(getErrorMessage(err));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-modal border border-neutral-200 overflow-hidden p-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 rounded-2xl bg-primary-subtle text-primary border border-primary/20 mb-1">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          Account Email Verification
        </h1>
        <p className="text-xs text-neutral-500">
          BioTrack Regulatory Compliance & Certified User Identity
        </p>
      </div>

      {/* Loading State */}
      {status === 'VERIFYING' && (
        <div className="p-6 bg-neutral-50 rounded-xl border border-neutral-200 flex flex-col items-center justify-center gap-3 text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-neutral-800">
              Validating Cryptographic Token...
            </p>
            <p className="text-xs text-neutral-500">
              Verifying token hash and certifying email ownership in the ledger.
            </p>
          </div>
        </div>
      )}

      {/* Success State */}
      {status === 'SUCCESS' && (
        <div className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
          <div className="p-5 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-col items-center justify-center gap-2.5 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <p className="text-base font-bold text-emerald-950">
              Email Verified Successfully!
            </p>
            <p className="text-xs text-emerald-800 leading-relaxed">
              {message}
            </p>
          </div>

          <Link href="/login" className="block w-full">
            <Button variant="primary" size="lg" className="w-full justify-center gap-2 font-bold shadow-xs">
              <span>Proceed to Login</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      )}

      {/* Error / Expired State */}
      {status === 'ERROR' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          <div className="p-5 bg-red-50 rounded-xl border border-red-200 flex flex-col items-center justify-center gap-2.5 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
              <XCircle className="w-7 h-7" />
            </div>
            <p className="text-base font-bold text-red-950">
              Verification Failed
            </p>
            <p className="text-xs text-red-800 leading-relaxed">
              {message}
            </p>
          </div>

          {/* Resend Verification Form */}
          <div className="pt-2 border-t border-neutral-100 space-y-3">
            <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
              Request New Verification Link
            </h3>

            {resendSuccess && (
              <Alert variant="success" title="Link Dispatched">
                {resendSuccess}
              </Alert>
            )}

            {resendError && (
              <Alert variant="danger" title="Request Failed">
                {resendError}
              </Alert>
            )}

            <form onSubmit={handleResend} className="space-y-2">
              <Input
                type="email"
                placeholder="Enter your registered email address"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
                className="text-xs"
              />
              <Button
                type="submit"
                variant="secondary"
                size="md"
                className="w-full justify-center gap-1.5 text-xs font-semibold"
                isLoading={isResending}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Resend Verification Email</span>
              </Button>
            </form>
          </div>

          <div className="pt-2 text-center">
            <Link
              href="/login"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Return to Login Portal
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4 py-8">
      <Suspense
        fallback={
          <div className="w-full max-w-md p-8 bg-white rounded-2xl border border-neutral-200 shadow-modal flex items-center justify-center">
            <div className="flex items-center gap-2 text-neutral-400 text-xs font-medium">
              <Activity className="w-5 h-5 text-primary animate-pulse" />
              <span>Loading verification terminal...</span>
            </div>
          </div>
        }
      >
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
