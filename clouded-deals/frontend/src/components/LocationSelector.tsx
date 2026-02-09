'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, CheckCircle } from 'lucide-react';
import { isVegasArea } from '@/lib/zipCodes';
import { zipToState } from '@/utils/zipToState';
import { RegionOverlay } from '@/components/RegionOverlay';
import { logZipInterest } from '@/lib/zipInterest';

type LocationState = 'idle' | 'editing' | 'confirmed' | 'region-overlay';

export function LocationSelector() {
  const [state, setState] = useState<LocationState>('idle');
  const [zipInput, setZipInput] = useState('');
  const [resolvedState, setResolvedState] = useState('');
  const [resolvedZip, setResolvedZip] = useState('');

  const handleZipSubmit = () => {
    const zip = zipInput.trim();
    if (zip.length !== 5) return;

    if (isVegasArea(zip)) {
      localStorage.setItem('clouded_zip', zip);
      setState('confirmed');
      setTimeout(() => setState('idle'), 3000);
    } else {
      const stateCode = zipToState(zip);
      if (stateCode) {
        logZipInterest(zip, stateCode);

        // Skip overlay if already dismissed this session
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
        // Unknown zip — just confirm Vegas
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
          className="w-24 sm:w-28 px-2 sm:px-3 py-2 min-h-[40px] text-sm bg-slate-800 border border-purple-500 rounded-lg text-white placeholder:text-slate-500 focus:outline-none"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleZipSubmit();
            if (e.key === 'Escape') setState('idle');
          }}
        />
        <button
          onClick={handleZipSubmit}
          className="p-2 min-w-[40px] min-h-[40px] text-xs sm:text-sm text-purple-400 hover:text-purple-300 font-medium"
        >
          Go
        </button>
      </div>
    );
  }

  // Confirmed state — brief success flash
  if (state === 'confirmed') {
    return (
      <div className="flex items-center gap-1 p-1.5 min-h-[40px] text-xs sm:text-sm text-green-400">
        <CheckCircle className="w-3.5 h-3.5" />
        <span>Las Vegas</span>
      </div>
    );
  }

  return (
    <>
      {/* Default idle state */}
      <button
        onClick={() => setState('editing')}
        className="flex items-center gap-1 p-1.5 min-h-[40px] text-xs sm:text-sm text-white hover:text-purple-400 transition-colors"
      >
        <MapPin className="w-3.5 h-3.5" />
        <span className="underline underline-offset-2 decoration-purple-500/50 truncate max-w-[80px] sm:max-w-none">
          Las Vegas
        </span>
      </button>

      {/* Portal overlay to document.body so it escapes the header's
         backdrop-filter stacking context (which traps position:fixed) */}
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
