'use client';

import { useEffect } from 'react';
import { MapPin, X, Bell } from 'lucide-react';

interface ComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
  city: string;
}

export function ComingSoonModal({ isOpen, onClose, city }: ComingSoonModalProps) {
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

  const displayCity = city || 'your city';

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-2xl w-full max-w-xs p-5 text-center relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 bg-purple-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
          <MapPin className="w-6 h-6 text-purple-400" />
        </div>

        <h2 className="text-lg font-bold text-white mb-2">Vegas only — for now</h2>

        <p className="text-sm text-slate-400 mb-5 leading-relaxed">
          We&apos;re not in {displayCity} yet, but we&apos;re expanding soon. Check out
          Vegas deals or drop your email to get notified.
        </p>

        <div className="space-y-2">
          <button
            onClick={onClose}
            className="w-full py-3 bg-purple-500 hover:bg-purple-400 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            Browse Vegas Deals
          </button>
          <button
            onClick={() => {
              window.open(
                'mailto:hello@cloudeddeals.com?subject=Notify me when you launch in ' +
                  displayCity,
                '_blank'
              );
              onClose();
            }}
            className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
          >
            <Bell className="w-4 h-4" />
            Notify me
          </button>
        </div>
      </div>
    </div>
  );
}
