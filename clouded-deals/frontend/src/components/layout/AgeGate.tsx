'use client';

import { ShieldCheck } from 'lucide-react';

interface AgeGateProps {
  onVerify: () => void;
}

export function AgeGate({ onVerify }: AgeGateProps) {
  const handleNo = () => {
    window.location.href = 'https://www.google.com';
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-950/30 via-slate-950 to-slate-950 pointer-events-none" />
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 text-center shadow-2xl">
        <div className="flex justify-center mb-5 sm:mb-6">
          <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Clouded<span className="text-purple-400">Deals</span>
          </span>
        </div>
        <div className="w-12 h-1 bg-purple-500 mx-auto rounded-full mb-5 sm:mb-6" />
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <ShieldCheck className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg sm:text-xl font-semibold text-white">Are you 21 or older?</h2>
          </div>
          <p className="text-slate-400 text-sm">
            You must be 21+ to view cannabis deals in Nevada.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleNo}
            className="flex-1 py-3.5 min-h-[48px] bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-all duration-300 active:scale-[0.98]"
          >
            No
          </button>
          <button
            onClick={onVerify}
            className="flex-1 py-3.5 min-h-[48px] bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-purple-500/25 active:scale-[0.98]"
          >
            Yes, I&apos;m 21+
          </button>
        </div>
      </div>
    </div>
  );
}
