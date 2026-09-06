'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore, getDashboardPath } from '@/stores/authStore';
import { authApi, usersApi, getErrorMessage } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import {
  Activity,
  ShieldCheck,
  Lock,
  Mail,
  CheckCircle2,
  Building2,
  Truck,
  FileCheck,
  Sparkles,
} from 'lucide-react';

const loginSchema = z.object({
  email: z.string().min(1, 'Email address is required').email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface RolePreset {
  roleName: string;
  email: string;
  facility: string;
  badgeColor: string;
}

const PRESET_USERS: RolePreset[] = [
  { roleName: 'Hospital Admin', email: 'admin@citygeneral.in', facility: 'City General Hospital', badgeColor: 'border-blue-300 text-blue-700 bg-blue-50' },
  { roleName: 'Hospital Staff', email: 'staff@citygeneral.in', facility: 'City General Hospital', badgeColor: 'border-blue-200 text-blue-600 bg-blue-50/60' },
  { roleName: 'Collection Staff', email: 'collection@biotrack.in', facility: 'Central Logistics', badgeColor: 'border-amber-300 text-amber-700 bg-amber-50' },
  { roleName: 'Transport Driver', email: 'transport@biotrack.in', facility: 'BioTrack Fleet', badgeColor: 'border-emerald-300 text-emerald-700 bg-emerald-50' },
  { roleName: 'Treatment Staff', email: 'facility@greendispose.in', facility: 'GreenDispose CBWTF', badgeColor: 'border-purple-300 text-purple-700 bg-purple-50' },
  { roleName: 'Government Auditor', email: 'gov@mpcb.gov.in', facility: 'State PCB HQ', badgeColor: 'border-indigo-300 text-indigo-700 bg-indigo-50' },
  { roleName: 'Super Admin', email: 'admin@biotrack.in', facility: 'Platform Root', badgeColor: 'border-neutral-400 text-neutral-800 bg-neutral-100' },
];

const DEFAULT_PASSWORD = 'BioTrack@2026';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect');
  const isSessionExpired = searchParams.get('session') === 'expired';

  const { setAuth, isAuthenticated, user } = useAuthStore();
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onBlur',
  });

  // If already authenticated, forward to dashboard
  React.useEffect(() => {
    if (isAuthenticated && user) {
      router.replace(redirectUrl || getDashboardPath(user.role));
    }
  }, [isAuthenticated, user, redirectUrl, router]);

  const onSubmit = async (values: LoginFormValues) => {
    setErrorMsg(null);
    try {
      // 1. Authenticate against real backend POST /api/auth/login
      const loginRes = await authApi.login({
        email: values.email,
        password: values.password,
      });

      // 2. Fetch verified user profile & facility details from GET /api/users/me
      const profile = await usersApi.me();

      // Deactivated account barrier
      if ((profile as unknown as { status?: string }).status === 'DEACTIVATED') {
        const { clearAuth } = useAuthStore.getState();
        clearAuth();
        setErrorMsg('Your account has been deactivated by administration. Please contact your system supervisor.');
        return;
      }

      // 3. Store in memory (Zustand & API client)
      setAuth(profile, loginRes.accessToken);

      // 4. Redirect to intended destination or role dashboard
      const target = redirectUrl || getDashboardPath(profile.role);
      router.push(target);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  };

  const applyPreset = (presetEmail: string) => {
    setValue('email', presetEmail, { shouldValidate: true });
    setValue('password', DEFAULT_PASSWORD, { shouldValidate: true });
    setErrorMsg(null);
  };

  return (
    <div className="w-full max-w-5xl bg-white rounded-2xl shadow-modal border border-neutral-200 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[620px]">
      {/* Left Column: Regulatory & Mission Context (design.md §18.1) */}
      <div className="lg:col-span-5 bg-neutral-900 text-white p-8 md:p-10 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center font-bold text-white shadow-md">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white block leading-tight">
                BioTrack Pro
              </span>
              <span className="text-[11px] text-neutral-400 font-semibold tracking-wider uppercase">
                VyomCare Healthcare Platform
              </span>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/20 text-blue-300 border border-primary/30 mb-3">
                <ShieldCheck className="w-3.5 h-3.5" />
                CPCB 2016 Statutory Mandate
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-white leading-snug">
                Unbroken Chain-of-Custody for Hazardous Waste
              </h2>
              <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
                Real-time tracking of clinical waste from generation through verified destruction at approved CBWTF facilities.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-neutral-800 flex items-center justify-center text-primary-subtle flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xs text-neutral-300">
                  <strong className="text-white block">Tamper-Proof Digital Verification</strong>
                  Cryptographically hashed QR workflows and 5-stage arrival validation.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-neutral-800 flex items-center justify-center text-primary-subtle flex-shrink-0 mt-0.5">
                  <Truck className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-xs text-neutral-300">
                  <strong className="text-white block">Continuous GIS Telemetry</strong>
                  Live transit tracking with automated corridor deviation detection.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-neutral-800 flex items-center justify-center text-primary-subtle flex-shrink-0 mt-0.5">
                  <FileCheck className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-xs text-neutral-300">
                  <strong className="text-white block">State PCB Oversight Desk</strong>
                  Real-time violation alerts and statutory compliance audit trails.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 pt-8 border-t border-neutral-800/80 text-xs text-neutral-500 flex items-center justify-between">
          <span>Production Build v1.0</span>
          <span>Security Protocol TLS 1.3</span>
        </div>
      </div>

      {/* Right Column: Authentication Card & Role Presets */}
      <div className="lg:col-span-7 p-8 md:p-10 flex flex-col justify-between">
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
              Sign in to BioTrack
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Enter your certified credentials or select an operational preset.
            </p>
          </div>

          {/* Session Expired Banner */}
          {isSessionExpired && (
            <div className="mb-5">
              <Alert variant="warning" title="Session Expired">
                Your session has expired for security. Please re-authenticate to continue.
              </Alert>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="mb-5">
              <Alert variant="danger" title="Authentication Failed" onDismiss={() => setErrorMsg(null)}>
                {errorMsg}
              </Alert>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Official Email Address"
              type="email"
              placeholder="e.g. staff@citygeneral.in"
              autoComplete="email"
              leftIcon={<Mail className="w-4 h-4" />}
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Security Password"
              type="password"
              placeholder="••••••••••••"
              autoComplete="current-password"
              leftIcon={<Lock className="w-4 h-4" />}
              error={errors.password?.message}
              {...register('password')}
            />

            <Button
              type="submit"
              size="lg"
              className="w-full mt-2 font-semibold justify-center"
              isLoading={isSubmitting}
            >
              {isSubmitting ? 'Authenticating credentials...' : 'Authenticate & Enter Gateway'}
            </Button>
          </form>

          {/* Role Presets Section (design.md §18.1) - Gated by NEXT_PUBLIC_DEMO_MODE */}
          {process.env.NEXT_PUBLIC_DEMO_MODE !== 'false' && (
            <div className="mt-8 pt-6 border-t border-neutral-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-700 uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Quick Role Presets (Demo & Audit Mode)</span>
                </div>
                <span className="text-[10px] text-neutral-400">Password: BioTrack@2026</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PRESET_USERS.map((preset) => (
                  <button
                    key={preset.email}
                    type="button"
                    onClick={() => applyPreset(preset.email)}
                    className={`p-2 text-left rounded-lg border transition-all text-xs hover:shadow-xs active:scale-98 cursor-pointer ${preset.badgeColor}`}
                  >
                    <span className="font-semibold block truncate">{preset.roleName}</span>
                    <span className="text-[10px] opacity-75 truncate flex items-center gap-1 mt-0.5">
                      <Building2 className="w-2.5 h-2.5 flex-shrink-0" />
                      <span className="truncate">{preset.facility}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="pt-6 text-center text-xs text-neutral-400 border-t border-neutral-100 mt-6">
          Restricted governmental and clinical waste management intranet. Unauthorized access is prohibited by law.
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-5xl h-[620px] bg-white rounded-2xl border border-neutral-200 shadow-modal flex items-center justify-center">
          <div className="flex items-center gap-2 text-neutral-400 text-xs font-medium">
            <Activity className="w-5 h-5 text-primary animate-pulse" />
            <span>Loading authentication portal...</span>
          </div>
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
