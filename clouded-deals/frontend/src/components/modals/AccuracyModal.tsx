'use client';

import { useEffect } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface AccuracyModalProps {
  isOpen: boolean;
  onClose: (accurate: boolean) => void;
}

export function AccuracyModal({ isOpen, onClose }: AccuracyModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(true);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[105] flex items-center justify-center p-4"
      onClick={() => onClose(true)}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-soft-reveal" />
      <div
        className="relative w-full max-w-sm glass-strong frost rounded-2xl overflow-hidden animate-soft-reveal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Quick feedback</h2>
          <p className="text-slate-400 mb-6">Was this deal accurate?</p>

          <div className="flex gap-3">
            <button
              onClick={() => onClose(true)}
              className="flex-1 py-4 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2.5 bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/20"
            >
              <ThumbsUp className="w-5 h-5" />
              Yes
            </button>
            <button
              onClick={() => onClose(false)}
              className="flex-1 py-4 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/20"
            >
              <ThumbsDown className="w-5 h-5" />
              No
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
