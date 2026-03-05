'use client';

import { useState, useEffect } from 'react';

const COACH_MARKS_KEY = 'clouded_coach_marks_seen';

type CoachMarkId = 'swipe_hints' | 'modal_drag' | 'dispo_expand';

function hasSeenMark(id: CoachMarkId): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem(COACH_MARKS_KEY);
    const seen: string[] = raw ? JSON.parse(raw) : [];
    return seen.includes(id);
  } catch { return true; }
}

function markAsSeen(id: CoachMarkId): void {
  try {
    const raw = localStorage.getItem(COACH_MARKS_KEY);
    const seen: string[] = raw ? JSON.parse(raw) : [];
    if (!seen.includes(id)) {
      seen.push(id);
      localStorage.setItem(COACH_MARKS_KEY, JSON.stringify(seen));
    }
  } catch { /* ignore */ }
}

interface CoachMarkProps {
  id: CoachMarkId;
  children: React.ReactNode;
  /** Duration in ms before auto-dismiss (default: 3000) */
  duration?: number;
}

export function CoachMark({ id, children, duration = 3000 }: CoachMarkProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (hasSeenMark(id)) return;
    // Small delay before showing
    const showTimer = setTimeout(() => setVisible(true), 500);
    const hideTimer = setTimeout(() => {
      setVisible(false);
      markAsSeen(id);
    }, 500 + duration);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [id, duration]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      role="presentation"
      className="pointer-events-none animate-in fade-in duration-500"
      style={{ animation: `fadeInOut ${duration}ms ease-in-out forwards` }}
    >
      {children}
    </div>
  );
}
