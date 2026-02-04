'use client';

import { useEffect } from 'react';
import { Heart } from 'lucide-react';

interface NineClearModalProps {
  isOpen: boolean;
  onContinue: () => void;
  savedCount: number;
}

export function NineClearModal({ isOpen, onContinue, savedCount }: NineClearModalProps) {
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
        <h2 className="text-lg sm:text-xl font-bold text-white mb-2">Nice haul!</h2>

        <p className="text-sm text-slate-400 mb-5">
          {savedCount} deals saved. We&apos;ll keep them safe for you.
        </p>

        <div className="bg-slate-700/50 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-center gap-3">
            <span className="text-sm text-slate-300">Find them anytime</span>
            <span className="text-purple-400">&rarr;</span>
            <div className="relative">
              <Heart className="w-6 h-6 text-purple-400 fill-purple-400" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {savedCount > 9 ? '9+' : savedCount}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onContinue}
          className="w-full py-3 min-h-[48px] bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-colors text-sm sm:text-base"
        >
          Keep hunting
        </button>
      </div>
    </div>
  );
}
