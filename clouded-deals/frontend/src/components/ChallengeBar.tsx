'use client';

import type { ChallengeDefinition } from '@/config/challenges';

interface ChallengeBarProps {
  onboardingComplete: boolean;
  onboardingProgress: { current: number; total: number; isCompleted: boolean };
  nextChallenge: {
    challenge: ChallengeDefinition;
    progress: { progress: number; isCompleted: boolean };
  } | null;
}

function getTarget(challenge: ChallengeDefinition): number {
  const req = challenge.requirement;
  if ('count' in req) return req.count;
  if ('uniqueDispensaries' in req) return req.uniqueDispensaries;
  if ('sameBrand' in req) return req.sameBrand;
  return 0;
}

export function ChallengeBar({
  onboardingComplete,
  onboardingProgress,
  nextChallenge,
}: ChallengeBarProps) {
  // Onboarding phase
  if (!onboardingComplete) {
    const { current, total } = onboardingProgress;
    const pct = Math.min((current / total) * 100, 100);

    return (
      <div className="glass-subtle frost rounded-xl px-4 py-3 mb-4 animate-in fade-in">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-200">
            {'\uD83D\uDC4B'} Rate {total} deals to unlock your feed
          </span>
          <span className="text-xs text-slate-500 tabular-nums">
            {current}/{total}
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-400"
            style={{
              width: `${pct}%`,
              transition: 'width 500ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </div>
      </div>
    );
  }

  // Post-onboarding: show next challenge
  if (!nextChallenge) return null;

  const { challenge, progress } = nextChallenge;
  const target = getTarget(challenge);
  const pct = target > 0 ? Math.min((progress.progress / target) * 100, 100) : 0;

  return (
    <div className="glass-subtle frost rounded-xl px-4 py-3 mb-4 animate-in fade-in">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-200">
          {challenge.icon} {challenge.description}
        </span>
        <span className="text-xs text-slate-500 tabular-nums">
          {progress.progress}/{target}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden bg-white/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-400"
          style={{
            width: `${pct}%`,
            transition: 'width 500ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>
    </div>
  );
}
