'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h1 className="text-5xl font-bold text-red-400 mb-4">Oops</h1>
        <h2 className="text-xl font-semibold text-white mb-3">
          Something went wrong
        </h2>
        <p className="text-slate-400 text-sm mb-8">
          An unexpected error occurred. Try refreshing, or head back to the deals page.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-6 py-3 bg-purple-500 hover:bg-purple-400 text-white font-semibold rounded-xl transition-colors"
          >
            Try Again
          </button>
          <a
            href="/"
            className="px-6 py-3 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 font-medium rounded-xl transition-colors"
          >
            Back to Deals
          </a>
        </div>
      </div>
    </div>
  );
}
