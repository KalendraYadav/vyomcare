'use client';

import { useEffect } from 'react';
import { AlertOctagon, RotateCw } from 'lucide-react';
import { getErrorMessage } from '@/lib/api';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log sanitized error in development only
    if (process.env.NODE_ENV === 'development') {
      console.error('Unhandled Application Error:', error);
    }
  }, [error]);

  const message = getErrorMessage(error);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 px-4 text-center">
      <div className="card p-8 max-w-md w-full flex flex-col items-center gap-4 shadow-raised">
        <div className="w-12 h-12 rounded-full bg-status-danger-bg flex items-center justify-center text-status-danger">
          <AlertOctagon className="w-6 h-6" />
        </div>
        <h1 className="text-heading-lg font-bold text-neutral-900">Application Error</h1>
        <p className="text-body text-neutral-600">{message}</p>
        <div className="flex gap-3 w-full mt-2">
          <button
            onClick={() => reset()}
            className="btn btn-primary flex-1 justify-center gap-2"
          >
            <RotateCw className="w-4 h-4" />
            Retry
          </button>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') window.location.href = '/';
            }}
            className="btn btn-secondary flex-1 justify-center"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
