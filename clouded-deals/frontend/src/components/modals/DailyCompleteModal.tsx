'use client';

import { useEffect } from 'react';

interface DailyCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNextDay: () => void;
  stats: {
    saved: number;
    viewed: number;
    potentialSavings: number;
  };
}

export function DailyCompleteModal({
  isOpen,
  onClose,
  onNextDay,
  stats,
}: DailyCompleteModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl max-w-sm w-full p-5 sm:p-6 text-center">
        <h2 className="text-lg sm:text-xl font-bold text-white mb-2">
          Daily sweep complete!
        </h2>
        <p className="text-slate-400 text-sm mb-4">
          You&apos;ve discovered all of today&apos;s deals
        </p>

        <div className="bg-slate-700/50 rounded-xl p-4 mb-5 sm:mb-6">
          <div className="grid grid-cols-3 gap-3 sm:gap-4 text-center">
            <div>
              <div className="text-xl sm:text-2xl font-bold text-purple-400">
                {stats.saved}
              </div>
              <div className="text-[10px] sm:text-xs text-slate-400 mt-0.5">Saved</div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-white">
                {stats.viewed}
              </div>
              <div className="text-[10px] sm:text-xs text-slate-400 mt-0.5">Viewed</div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-green-400">
                ${stats.potentialSavings}
              </div>
              <div className="text-[10px] sm:text-xs text-slate-400 mt-0.5">Savings</div>
            </div>
          </div>
        </div>

        <button
          onClick={onNextDay}
          className="w-full py-3 px-4 min-h-[48px] bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-colors mb-3 text-sm sm:text-base"
        >
          Sneak Peek: Tomorrow&apos;s Deals
        </button>

        <button
          onClick={onClose}
          className="w-full py-2.5 px-4 min-h-[44px] text-slate-400 hover:text-white text-sm transition-colors"
        >
          View saved deals
        </button>
      </div>
    </div>
  );
}
