'use client';

import { useState, useCallback } from 'react';
import { ValuePropSplash } from './ValuePropSplash';
import { LocationPrompt } from './LocationPrompt';
import type { UserCoords } from './LocationPrompt';
import { trackEvent } from '@/lib/analytics';

const FTUE_KEY = 'clouded_ftue_completed';

export function isFTUECompleted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(FTUE_KEY) === 'true';
}

export function markFTUECompleted(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FTUE_KEY, 'true');
}

type FTUEStep = 'splash' | 'location';

interface FTUEFlowProps {
  dealCount: number;
  onComplete: (prefs: string[], coords: UserCoords | null) => void;
}

export function FTUEFlow({ dealCount, onComplete }: FTUEFlowProps) {
  const [step, setStep] = useState<FTUEStep>('splash');

  const finish = useCallback(
    (coords: UserCoords | null) => {
      markFTUECompleted();
      trackEvent('onboarding_completed', undefined, {
        location: coords ? 'granted' : 'denied',
      });
      onComplete([], coords);
    },
    [onComplete]
  );

  // Skip the entire FTUE
  const handleSkipAll = useCallback(() => {
    finish(null);
  }, [finish]);

  if (step === 'splash') {
    return (
      <ValuePropSplash
        dealCount={dealCount}
        onContinue={() => setStep('location')}
        onSkip={handleSkipAll}
      />
    );
  }

  if (step === 'location') {
    return (
      <LocationPrompt
        onContinue={(coords) => finish(coords)}
      />
    );
  }

  return null;
}
