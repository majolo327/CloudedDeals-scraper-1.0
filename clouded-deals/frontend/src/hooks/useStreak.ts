'use client';

import { useState, useEffect } from 'react';

interface StreakData {
  lastVisit: string;
  streak: number;
}

export function useStreak() {
  const [streak, setStreak] = useState(1);
  const [isNewMilestone, setIsNewMilestone] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem('clouded_streak');
    const today = new Date().toISOString().split('T')[0];

    if (stored) {
      try {
        const data: StreakData = JSON.parse(stored);
        const lastVisit = data.lastVisit;

        const last = new Date(lastVisit);
        const now = new Date(today);
        const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          setStreak(data.streak);
        } else if (diffDays === 1) {
          const newStreak = data.streak + 1;
          setStreak(newStreak);
          localStorage.setItem('clouded_streak', JSON.stringify({
            lastVisit: today,
            streak: newStreak
          }));
          if ([3, 7, 14, 30].includes(newStreak)) {
            setIsNewMilestone(newStreak);
          }
        } else {
          setStreak(1);
          localStorage.setItem('clouded_streak', JSON.stringify({
            lastVisit: today,
            streak: 1
          }));
        }
      } catch {
        localStorage.setItem('clouded_streak', JSON.stringify({
          lastVisit: today,
          streak: 1
        }));
      }
    } else {
      localStorage.setItem('clouded_streak', JSON.stringify({
        lastVisit: today,
        streak: 1
      }));
    }
  }, []);

  return {
    streak,
    isNewMilestone,
    clearMilestone: () => setIsNewMilestone(null)
  };
}
