'use client';

import { useState, useCallback } from 'react';
import { ValuePropSplash } from './ValuePropSplash';
import { PreferenceSelector } from './PreferenceSelector';
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

type FTUEStep = 'splash' | 'preferences' | 'location';

interface FTUEFlowProps {
  dealCount: number;
  onComplete: (prefs: string[], coords: UserCoords | null) => void;
}

export function FTUEFlow({ dealCount, onComplete }: FTUEFlowProps) {
  const [step, setStep] = useState<FTUEStep>('splash');
  const [prefs, setPrefs] = useState<string[]>([]);

  const finish = useCallback(
    (finalPrefs: string[], coords: UserCoords | null) => {
      markFTUECompleted();
      trackEvent('onboarding_completed', undefined, {
        preferences: finalPrefs.join(','),
        location: coords ? 'granted' : 'denied',
      });
      onComplete(finalPrefs, coords);
    },
    [onComplete]
  );

  // Skip the entire FTUE
  const handleSkipAll = useCallback(() => {
    finish([], null);
  }, [finish]);

  if (step === 'splash') {
    return (
      <ValuePropSplash
        dealCount={dealCount}
        onContinue={() => setStep('preferences')}
        onSkip={handleSkipAll}
      />
    );
  }

  if (step === 'preferences') {
    return (
      <PreferenceSelector
        onContinue={(selectedPrefs) => {
          setPrefs(selectedPrefs);
          setStep('location');
        }}
        onSkip={() => setStep('location')}
      />
    );
  }

  if (step === 'location') {
    return (
      <LocationPrompt
        onContinue={(coords) => finish(prefs, coords)}
      />
    );
  }

  return null;
}
