'use client';

import { useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import { isVegasArea } from '@/lib/zipCodes';
import { zipToState } from '@/utils/zipToState';
import { RegionOverlay } from '@/components/RegionOverlay';
import { logZipInterest } from '@/lib/zipInterest';

const LOCATION_KEY = 'clouded_location_permission';
const COORDS_KEY = 'clouded_user_coords';

// Default: Las Vegas Strip
const DEFAULT_LAT = 36.1147;
const DEFAULT_LNG = -115.1728;

export interface UserCoords {
  lat: number;
  lng: number;
}

export function getLocationPermission(): 'granted' | 'denied' | 'pending' {
  if (typeof window === 'undefined') return 'pending';
  return (localStorage.getItem(LOCATION_KEY) as 'granted' | 'denied') || 'pending';
}

export function getUserCoords(): UserCoords | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(COORDS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return null;
}

export function getDefaultCoords(): UserCoords {
  return { lat: DEFAULT_LAT, lng: DEFAULT_LNG };
}

type PromptState = 'location' | 'zip-fallback' | 'region-overlay';

interface LocationPromptProps {
  onContinue: (coords: UserCoords | null) => void;
}

export function LocationPrompt({ onContinue }: LocationPromptProps) {
  const [requesting, setRequesting] = useState(false);
  const [promptState, setPromptState] = useState<PromptState>('location');
  const [zipInput, setZipInput] = useState('');
  const [resolvedState, setResolvedState] = useState('');
  const [resolvedZip, setResolvedZip] = useState('');

  const handleEnable = async () => {
    setRequesting(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000,
        });
      });

      const coords: UserCoords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      localStorage.setItem(LOCATION_KEY, 'granted');
      localStorage.setItem(COORDS_KEY, JSON.stringify(coords));
      trackEvent('onboarding_screen_viewed', undefined, {
        screen: 'location',
        result: 'granted',
      });
      onContinue(coords);
    } catch {
      localStorage.setItem(LOCATION_KEY, 'denied');
      trackEvent('onboarding_screen_viewed', undefined, {
        screen: 'location',
        result: 'denied',
      });
      // Show zip fallback instead of immediately continuing
      setPromptState('zip-fallback');
    } finally {
      setRequesting(false);
    }
  };

  const handleNotNow = () => {
    localStorage.setItem(LOCATION_KEY, 'denied');
    trackEvent('onboarding_skipped', undefined, { screen: 'location' });
    setPromptState('zip-fallback');
  };

  const handleZipSubmit = () => {
    const zip = zipInput.trim();
    if (zip.length !== 5) return;

    if (isVegasArea(zip)) {
      localStorage.setItem('clouded_zip', zip);
      onContinue(null);
      return;
    }

    const stateCode = zipToState(zip);
    if (!stateCode) {
      onContinue(null);
      return;
    }

    // Non-Vegas zip — log interest and show overlay
    logZipInterest(zip, stateCode);
    setResolvedState(stateCode);
    setResolvedZip(zip);
    setPromptState('region-overlay');
  };

  const handleSkipZip = () => {
    onContinue(null);
  };

  const handleEmailSubmit = (email: string, stateCode: string, zip: string) => {
    logZipInterest(zip, stateCode, email);
  };

  // Region overlay for non-NV users
  if (promptState === 'region-overlay') {
    return (
      <RegionOverlay
        stateCode={resolvedState}
        zip={resolvedZip}
        onBrowseVegas={() => onContinue(null)}
        onEmailSubmit={handleEmailSubmit}
      />
    );
  }

  // Zip code fallback — shown when user denies location
  if (promptState === 'zip-fallback') {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col" style={{ backgroundColor: 'var(--surface-0)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(88, 28, 135, 0.15) 0%, transparent 60%)' }} />

        {/* Skip */}
        <div className="relative z-10 flex justify-end p-4">
          <button
            onClick={handleSkipZip}
            className="text-sm text-slate-600 hover:text-slate-400 transition-colors py-2 px-3"
          >
            Skip
          </button>
        </div>

        {/* Main content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="relative mb-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-20 h-20 rounded-2xl bg-purple-500/10 flex items-center justify-center">
              <MapPin className="w-10 h-10 text-purple-400" />
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
            Where are you?
          </h2>
          <p className="text-base text-slate-400 max-w-sm leading-relaxed mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
            We&apos;re live in Las Vegas right now. Enter your zip and we&apos;ll let you know if we&apos;re in your area.
          </p>

          <div className="w-full max-w-xs animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
            <input
              type="text"
              inputMode="numeric"
              value={zipInput}
              onChange={(e) => setZipInput(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="Enter zip code"
              className="w-full px-4 py-4 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-center text-lg font-medium placeholder:text-slate-600 focus:outline-none focus:border-purple-500/40 mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleZipSubmit();
              }}
            />
          </div>
        </div>

        {/* CTAs */}
        <div className="relative z-10 px-6 pb-10 sm:pb-14 pt-6 space-y-3">
          <button
            onClick={handleZipSubmit}
            disabled={zipInput.length !== 5}
            className="w-full py-4 min-h-[56px] bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-semibold text-base rounded-2xl shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
          >
            Check My Area
          </button>
          <button
            onClick={handleSkipZip}
            className="w-full py-3 min-h-[48px] text-slate-500 hover:text-slate-300 text-sm font-medium transition-colors"
          >
            Just show me Vegas deals
          </button>
        </div>
      </div>
    );
  }

  // Default: location permission request
  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ backgroundColor: 'var(--surface-0)' }}>
      {/* Background gradient */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(16, 185, 129, 0.12) 0%, transparent 60%)' }} />

      {/* Skip */}
      <div className="relative z-10 flex justify-end p-4">
        <button
          onClick={handleNotNow}
          className="text-sm text-slate-600 hover:text-slate-400 transition-colors py-2 px-3"
        >
          Not Now
        </button>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
        {/* Illustration */}
        <div className="relative mb-8 animate-in fade-in zoom-in-95 duration-500">
          <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <MapPin className="w-10 h-10 text-emerald-400" />
          </div>
          {/* Distance indicator orbiting */}
          <div className="absolute -top-2 -right-4 px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[10px] text-slate-300 font-medium animate-in fade-in slide-in-from-left-2 duration-500 delay-300">
            2.3 mi
          </div>
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
          See deals near you
        </h2>
        <p className="text-base text-slate-400 max-w-sm leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
          We&apos;ll show you how far each dispensary is and give you one-tap directions.
        </p>
      </div>

      {/* CTAs */}
      <div className="relative z-10 px-6 pb-10 sm:pb-14 pt-6 space-y-3">
        <button
          onClick={handleEnable}
          disabled={requesting}
          className="w-full py-4 min-h-[56px] bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold text-base rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {requesting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Requesting...
            </>
          ) : (
            <>
              <Navigation className="w-5 h-5" />
              Enable Location
            </>
          )}
        </button>
        <button
          onClick={handleNotNow}
          className="w-full py-3 min-h-[48px] text-slate-500 hover:text-slate-300 text-sm font-medium transition-colors"
        >
          Not Now
        </button>
      </div>
    </div>
  );
}
