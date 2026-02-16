'use client';

import { useEffect, useState } from 'react';
import { Check, Heart, X, Trophy, Sparkles } from 'lucide-react';

export interface ToastData {
  id: string;
  message: string;
  type: 'success' | 'info' | 'saved' | 'removed' | 'milestone' | 'discovery';
}

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const duration = ['milestone', 'discovery'].includes(toast.type) ? 3500 : 2500;
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.type, onDismiss]);

  const icons = {
    success: <Check className="w-4 h-4" />,
    info: <Check className="w-4 h-4" />,
    saved: <Heart className="w-4 h-4 fill-current" />,
    removed: <X className="w-4 h-4" />,
    milestone: <Trophy className="w-4 h-4" />,
    discovery: <Sparkles className="w-4 h-4" />
  };

  const colors = {
    success: 'bg-purple-500/20 border-purple-500/30 text-purple-400',
    info: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
    saved: 'bg-purple-500/20 border-purple-500/30 text-purple-400',
    removed: 'bg-slate-700/80 border-slate-600/50 text-slate-300',
    milestone: 'bg-amber-500/20 border-amber-500/30 text-amber-400',
    discovery: 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400'
  };

  return (
    <div
      className={`flex items-center gap-2 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-xl transition-all duration-300 animate-toast-in ${colors[toast.type]} ${
        isLeaving ? 'translate-y-2 opacity-0' : ''
      }`}
    >
      <span className="shrink-0">{icons[toast.type]}</span>
      <span className="text-sm font-medium">{toast.message}</span>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-[106] flex flex-col gap-2 pointer-events-none md:bottom-6" style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
