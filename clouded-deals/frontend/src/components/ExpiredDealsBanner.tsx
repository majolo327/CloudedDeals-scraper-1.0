'use client';

import { useState, useEffect } from 'react';
import { Clock, Bell, Sunrise, X } from 'lucide-react';

interface ExpiredDealsBannerProps {
  expiredCount: number;
  onDismiss?: () => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getNextDropMessage(): string {
  const now = new Date();
  const ptStr = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  const pt = new Date(ptStr);
  const hour = pt.getHours();

  if (hour < 8) {
    const hoursLeft = 7 - hour;
    const minsLeft = 59 - pt.getMinutes();
    if (hoursLeft <= 0) return `New deals dropping in ${minsLeft}m`;
    return `New deals drop around 8 AM (${hoursLeft}h ${minsLeft}m)`;
  }
  if (hour < 10) {
    return "Today's deals are being prepared — check back shortly!";
  }
  return 'New deals drop every morning around 8 AM PT.';
}

export function ExpiredDealsBanner({ expiredCount, onDismiss }: ExpiredDealsBannerProps) {
  const [nextDrop, setNextDrop] = useState(getNextDropMessage);

  useEffect(() => {
    const interval = setInterval(() => {
      setNextDrop(getNextDropMessage());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-950/40 via-slate-900/60 to-slate-900/40 p-5 mb-6">
      {/* Subtle animated gradient accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 p-2 min-w-[44px] min-h-[44px] rounded-lg text-slate-600 hover:text-slate-400 transition-colors flex items-center justify-center"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="relative">
        {/* Greeting + Icon */}
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
            <Sunrise className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">
              {getGreeting()}, early bird!
            </h3>
            <p className="text-xs text-slate-400">
              You&apos;re here before the new deals
            </p>
          </div>
        </div>

        {/* Main message */}
        <p className="text-sm text-slate-300 mb-3 leading-relaxed">
          {expiredCount > 0 ? (
            <>
              Yesterday&apos;s <span className="text-purple-400 font-medium">{expiredCount} deals</span> are
              shown below — browse while we get today&apos;s deals together.
              Prices may have changed, so verify at the dispensary.
            </>
          ) : (
            <>We&apos;re getting today&apos;s deals together. Check back soon!</>
          )}
        </p>

        {/* Next drop timer */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Clock className="w-3.5 h-3.5 text-purple-400/70" />
          <span>{nextDrop}</span>
        </div>

        {/* Notification CTA */}
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => {
              // Scroll to SMS waitlist or show it
              const el = document.querySelector('[data-sms-waitlist]');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-purple-500/15 text-purple-400 text-xs font-medium hover:bg-purple-500/25 transition-colors"
          >
            <Bell className="w-3.5 h-3.5" />
            Get notified when deals drop
          </button>
        </div>
      </div>
    </div>
  );
}
