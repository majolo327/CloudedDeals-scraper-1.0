'use client';

import { ShieldCheck, Star, Tag, MapPin } from 'lucide-react';
import type { Zone } from '@/types';

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

export function StaffPickBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-400 ${className}`}
    >
      <Star className="w-3 h-3" />
      Staff Pick
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

const ZONE_COLORS: Record<Zone, string> = {
  strip: 'text-amber-400 bg-amber-500/10',
  downtown: 'text-purple-400 bg-purple-500/10',
  local: 'text-blue-400 bg-blue-500/10',
  henderson: 'text-teal-400 bg-teal-500/10',
  north: 'text-orange-400 bg-orange-500/10',
};

const ZONE_LABELS: Record<Zone, string> = {
  strip: 'The Strip',
  downtown: 'Downtown',
  local: 'Local',
  henderson: 'Henderson',
  north: 'North LV',
};

export function ZoneBadge({
  zone,
  className = '',
}: {
  zone: Zone;
  className?: string;
}) {
  const colors = ZONE_COLORS[zone] || 'text-slate-400 bg-slate-500/10';
  const label = ZONE_LABELS[zone] || zone;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors} ${className}`}
    >
      <MapPin className="w-3 h-3" />
      {label}
    </span>
  );
}
