'use client';

import { ShieldCheck, Tag } from 'lucide-react';

export { DealBadge } from './DealBadge';

export function VerifiedBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 ${className}`}
    >
      <ShieldCheck className="w-3 h-3" />
      Verified
    </span>
  );
}

export function CategoryBadge({
  category,
  className = '',
}: {
  category: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-slate-700/50 px-2 py-0.5 text-[10px] font-medium text-slate-400 ${className}`}
    >
      <Tag className="w-3 h-3" />
      {category}
    </span>
  );
}
