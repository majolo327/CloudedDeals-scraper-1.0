'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Navigation, CheckCircle, Loader2 } from 'lucide-react';
import { isVegasArea, getLocationDisplayLabel, nearestZipFromCoords } from '@/lib/zipCodes';
import { zipToState } from '@/utils/zipToState';
import { RegionOverlay } from '@/components/RegionOverlay';
import { logZipInterest } from '@/lib/zipInterest';

const LOCATION_KEY = 'clouded_location_permission';
const COORDS_KEY = 'clouded_user_coords';

type LocationState = 'idle' | 'locating' | 'editing' | 'confirmed' | 'region-overlay';

export function LocationSelector() {
  const [state, setState] = useState<LocationState>('idle');
  const [zipInput, setZipInput] = useState('');
  const [resolvedState, setResolvedState] = useState('');
  const [resolvedZip, setResolvedZip] = useState('');
  const [displayLabel, setDisplayLabel] = useState('Las Vegas');
  const [geoGranted, setGeoGranted] = useState(false);

  /** Derive a display label from lat/lng via nearest known zip. */
  const labelFromCoords = useCallback((lat: number, lng: number): string => {
    const zip = nearestZipFromCoords(lat, lng);
    if (zip) {
      localStorage.setItem('clouded_zip', zip);
      return getLocationDisplayLabel(zip);
    }
    return 'Las Vegas';
  }, []);

  // On mount: resolve the best available label from stored state
  useEffect(() => {
    const permission = localStorage.getItem(LOCATION_KEY);
    const granted = permission === 'granted';
    setGeoGranted(granted);

    if (granted) {
      try {
        const raw = localStorage.getItem(COORDS_KEY);
        if (raw) {
          const { lat, lng } = JSON.parse(raw);
          setDisplayLabel(labelFromCoords(lat, lng));
          return;
        }
      } catch { /* fall through */ }
    }

    // Fallback: stored zip
    const storedZip = localStorage.getItem('clouded_zip');
    if (storedZip && isVegasArea(storedZip)) {
      setDisplayLabel(getLocationDisplayLabel(storedZip));
    }
  }, [labelFromCoords]);

  /** Silently re-geolocate — called when a geolocated user taps the pin. */
  const handleGeolocate = useCallback(() => {
    if (!navigator.geolocation) {
      setState('editing');
      return;
    }

    setState('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        localStorage.setItem(COORDS_KEY, JSON.stringify({ lat, lng }));
        localStorage.setItem(LOCATION_KEY, 'granted');
        setGeoGranted(true);
        setDisplayLabel(labelFromCoords(lat, lng));
        setState('confirmed');
        setTimeout(() => setState('idle'), 2000);
      },
      () => {
        // Permission revoked or error — fall back to zip input
        localStorage.setItem(LOCATION_KEY, 'denied');
        setGeoGranted(false);
        setState('editing');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    );
  }, [labelFromCoords]);

  const handleZipSubmit = () => {
    const zip = zipInput.trim();
    if (zip.length !== 5) return;

    if (isVegasArea(zip)) {
      localStorage.setItem('clouded_zip', zip);
      setDisplayLabel(getLocationDisplayLabel(zip));
      setState('confirmed');
      setTimeout(() => setState('idle'), 3000);
    } else {
      const stateCode = zipToState(zip);
      if (stateCode) {
        logZipInterest(zip, stateCode);

        const wasDismissed = typeof window !== 'undefined' &&
          sessionStorage.getItem('clouded_region_dismissed') === 'true';
        if (wasDismissed) {
          setState('idle');
          return;
        }

        setResolvedState(stateCode);
        setResolvedZip(zip);
        setState('region-overlay');
      } else {
        setState('confirmed');
        setTimeout(() => setState('idle'), 3000);
      }
    }
  };

  const handleClose = () => {
    setState('idle');
    setZipInput('');
    setResolvedState('');
    setResolvedZip('');
  };

  const handleEmailSubmit = (email: string, stateCode: string, zip: string) => {
    logZipInterest(zip, stateCode, email);
  };

  const handleIdleClick = () => {
    if (geoGranted) {
      handleGeolocate();
    } else {
      setState('editing');
    }
  };

  // Locating state — brief spinner while re-geolocating
  if (state === 'locating') {
    return (
      <div className="flex items-center gap-1 p-1.5 min-h-[44px] text-xs sm:text-sm text-purple-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>Locating</span>
      </div>
    );
  }

  // Editing state — zip code input
  if (state === 'editing') {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={zipInput}
          onChange={(e) => setZipInput(e.target.value.replace(/\D/g, '').slice(0, 5))}
          placeholder="Zip code"
          className="w-24 sm:w-28 px-2 sm:px-3 py-2 min-h-[44px] text-sm bg-slate-800 border border-purple-500 rounded-lg text-white placeholder:text-slate-500 focus:outline-none"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleZipSubmit();
            if (e.key === 'Escape') setState('idle');
          }}
        />
        <button
          onClick={handleZipSubmit}
          className="p-2 min-w-[44px] min-h-[44px] text-xs sm:text-sm text-purple-400 hover:text-purple-300 font-medium"
        >
          Go
        </button>
      </div>
    );
  }

  // Confirmed state — brief success flash
  if (state === 'confirmed') {
    return (
      <div className="flex items-center gap-1 p-1.5 min-h-[44px] text-xs sm:text-sm text-green-400">
        <CheckCircle className="w-3.5 h-3.5" />
        <span>{displayLabel}</span>
      </div>
    );
  }

  // Idle state — geolocated users see Navigation icon, zip users see MapPin
  return (
    <>
      <button
        onClick={handleIdleClick}
        aria-label={`Location: ${displayLabel}. Tap to change.`}
        className="flex items-center gap-1 p-1.5 min-h-[44px] text-xs sm:text-sm text-white hover:text-purple-400 transition-colors"
      >
        {geoGranted ? (
          <Navigation className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <MapPin className="w-3.5 h-3.5" />
        )}
        <span className="underline underline-offset-2 decoration-purple-500/50 truncate max-w-[120px] sm:max-w-none">
          {displayLabel}
        </span>
      </button>

      {state === 'region-overlay' && createPortal(
        <RegionOverlay
          stateCode={resolvedState}
          zip={resolvedZip}
          onBrowseVegas={handleClose}
          onEmailSubmit={handleEmailSubmit}
        />,
        document.body,
      )}
    </>
  );
}
