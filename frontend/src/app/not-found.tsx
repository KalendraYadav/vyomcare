import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 px-4 text-center">
      <div className="card p-8 max-w-md w-full flex flex-col items-center gap-4 shadow-raised">
        <div className="w-12 h-12 rounded-full bg-status-pending-bg flex items-center justify-center text-status-pending">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h1 className="text-heading-lg font-bold text-neutral-900">404 — Page Not Found</h1>
        <p className="text-body text-neutral-600">
          The requested route or record does not exist on this BioTrack gateway.
        </p>
        <Link
          href="/"
          className="btn btn-primary mt-2 w-full justify-center"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
