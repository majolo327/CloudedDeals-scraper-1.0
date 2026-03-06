'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { SlidersHorizontal, X, RotateCcw, Check, MapPin, ChevronDown, Navigation, Loader2, Search, ArrowLeft } from 'lucide-react';
import { DISPENSARIES } from '@/data/dispensaries';
import { trackEvent } from '@/lib/analytics';
import { hapticLight } from '@/lib/haptics';
import { CoachMark } from './CoachMark';
import { isVegasArea, getZipCoordinates } from '@/lib/zipCodes';
import type {
  UniversalFilterState,
  DistanceRange,
} from '@/hooks/useUniversalFilters';
import { DEFAULT_UNIVERSAL_FILTERS } from '@/hooks/useUniversalFilters';

// Re-export for backwards compatibility with DealsPage
export type FilterState = UniversalFilterState;
export const DEFAULT_FILTERS = DEFAULT_UNIVERSAL_FILTERS;

/** Universal weight/size options — standard cannabis sizes consumers shop by. */
const WEIGHT_OPTIONS: { id: string; label: string }[] = [
  { id: 'disposable', label: 'Disposable' },
  { id: '0.5g', label: '0.5g' },
  { id: '1g', label: '1g' },
  { id: '3.5g', label: '3.5g' },
  { id: '7g', label: '7g' },
  { id: '14g', label: '14g' },
  { id: '28g', label: '28g' },
  { id: '100mg', label: '100mg' },
  { id: '200mg', label: '200mg' },
];

const DISTANCE_OPTIONS: { id: DistanceRange; label: string; desc: string }[] = [
  { id: 'all', label: 'Any Distance', desc: 'Show all deals' },
  { id: 'near', label: 'Near You', desc: 'Within 5 miles' },
  { id: 'nearby', label: 'Nearby', desc: 'Within 10 miles' },
  { id: 'across_town', label: 'Across Town', desc: 'Within 15 miles' },
];

type LocationPromptState = 'hidden' | 'choose' | 'requesting' | 'zip';

interface FilterSheetProps {
  filters: UniversalFilterState;
  onFiltersChange: (filters: UniversalFilterState) => void;
  filteredCount: number;
  hasLocation?: boolean;
  onReset?: () => void;
  activeFilterCount?: number;
  onLocationSet?: () => void;
  /** When true, opens the sheet and shows the location prompt (for "Nearest First" sort without location). */
  openForLocation?: boolean;
  onOpenForLocationHandled?: () => void;
}

export function FilterSheet({
  filters,
  onFiltersChange,
  filteredCount,
  hasLocation = false,
  onReset,
  activeFilterCount: externalActiveCount,
  onLocationSet,
  openForLocation = false,
  onOpenForLocationHandled,
}: FilterSheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationPrompt, setLocationPrompt] = useState<LocationPromptState>('hidden');
  const [zipInput, setZipInput] = useState('');
  const [zipError, setZipError] = useState('');
  const [dispensarySearch, setDispensarySearch] = useState('');
  const [dispoFullscreen, setDispoFullscreen] = useState(false);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  const dispoListRef = useRef<HTMLDivElement>(null);

  const dispensaries = useMemo(() => {
    return DISPENSARIES
      .map((d) => ({ id: d.id, name: d.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  // Recently selected dispensaries (persisted across sessions)
  const RECENT_DISPOS_KEY = 'clouded_recent_dispensaries';
  const MAX_RECENTS = 5;

  const recentDispoIds = useMemo(() => {
    if (typeof window === 'undefined') return [] as string[];
    try {
      const raw = localStorage.getItem(RECENT_DISPOS_KEY);
      return raw ? (JSON.parse(raw) as string[]).slice(0, MAX_RECENTS) : [];
    } catch { return [] as string[]; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // re-read when sheet opens

  const recentDispensaries = useMemo(() => {
    if (!recentDispoIds.length) return [];
    return recentDispoIds
      .map(id => dispensaries.find(d => d.id === id))
      .filter((d): d is { id: string; name: string } => !!d);
  }, [recentDispoIds, dispensaries]);

  // Track dispensary selection in recents
  const trackRecentDispensary = useCallback((id: string) => {
    try {
      const raw = localStorage.getItem(RECENT_DISPOS_KEY);
      const current: string[] = raw ? JSON.parse(raw) : [];
      const updated = [id, ...current.filter(d => d !== id)].slice(0, MAX_RECENTS);
      localStorage.setItem(RECENT_DISPOS_KEY, JSON.stringify(updated));
    } catch { /* storage full */ }
  }, []);

  const filteredDispensaries = useMemo(() => {
    if (!dispensarySearch.trim()) return dispensaries;
    const q = dispensarySearch.toLowerCase().trim();
    return dispensaries.filter((d) => d.name.toLowerCase().includes(q));
  }, [dispensaries, dispensarySearch]);

  const activeFilterCount = externalActiveCount ?? [
    filters.categories.length > 0,
    filters.dispensaryIds.length > 0,
    filters.distanceRange !== 'all',
    filters.weightFilters.length > 0,
  ].filter(Boolean).length;

  const handleReset = () => {
    if (onReset) {
      onReset();
    } else {
      onFiltersChange(DEFAULT_UNIVERSAL_FILTERS);
    }
    setLocationOpen(false);
    trackEvent('filter_change', undefined, { action: 'reset' });
  };

  const toggleDispensary = (id: string) => {
    hapticLight();
    const isAdding = !filters.dispensaryIds.includes(id);
    const next = isAdding
      ? [...filters.dispensaryIds, id]
      : filters.dispensaryIds.filter((d) => d !== id);
    if (isAdding) trackRecentDispensary(id);
    onFiltersChange({ ...filters, dispensaryIds: next, quickFilter: 'none' });
    trackEvent('dispensary_filtered', undefined, {
      dispensary_id: id,
      action: isAdding ? 'select' : 'deselect',
      total_selected: next.length,
    });
  };

  const selectAllDispensaries = () => {
    const all = dispensaries.map((d) => d.id);
    onFiltersChange({ ...filters, dispensaryIds: all, quickFilter: 'none' });
  };

  const clearAllDispensaries = () => {
    onFiltersChange({ ...filters, dispensaryIds: [], quickFilter: 'none' });
  };

  // Geolocation request for inline prompt
  const handleUseLocation = useCallback(async () => {
    setLocationPrompt('requesting');
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000,
        });
      });
      const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
      localStorage.setItem('clouded_user_coords', JSON.stringify(coords));
      setLocationPrompt('hidden');
      onFiltersChange({ ...filters, sortBy: 'distance' });
  
      onLocationSet?.();
      trackEvent('filter_change', undefined, { action: 'location_set', method: 'geolocation' });
    } catch {
      // Geolocation denied or failed — fall back to zip input
      setLocationPrompt('zip');
      setTimeout(() => zipInputRef.current?.focus(), 100);
    }
  }, [filters, onFiltersChange, onLocationSet]);

  // Zip code submission for inline prompt
  const handleZipSubmit = useCallback(() => {
    const zip = zipInput.trim();
    if (!/^\d{5}$/.test(zip)) {
      setZipError('Enter a 5-digit zip code');
      return;
    }
    if (!isVegasArea(zip)) {
      setZipError('Enter a Las Vegas area zip code');
      return;
    }
    const coords = getZipCoordinates(zip);
    if (!coords) {
      setZipError('Zip code not found');
      return;
    }
    localStorage.setItem('clouded_zip', zip);
    localStorage.setItem('clouded_user_coords', JSON.stringify(coords));
    setLocationPrompt('hidden');
    setZipInput('');
    setZipError('');
    onFiltersChange({ ...filters, sortBy: 'distance' });

    onLocationSet?.();
    trackEvent('filter_change', undefined, { action: 'location_set', method: 'zip', zip });
  }, [zipInput, filters, onFiltersChange, onLocationSet]);

  // Open sheet with location prompt when triggered externally (e.g., sort dropdown "Nearest First")
  useEffect(() => {
    if (openForLocation) {
      setIsOpen(true);
      setLocationPrompt('choose');
      onOpenForLocationHandled?.();
    }
  }, [openForLocation, onOpenForLocationHandled]);

  // Auto-expand location section when user has location or active location filters
  useEffect(() => {
    if (hasLocation || filters.distanceRange !== 'all' || filters.dispensaryIds.length > 0) {
      setLocationOpen(true);
    }
  }, [hasLocation, filters.distanceRange, filters.dispensaryIds]);

  // Lock body scroll when open; reset dispensary fullscreen on close
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setDispoFullscreen(false);
      setDispensarySearch('');
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Swipe-to-close on mobile — only from the drag handle area at top of sheet.
  // Prevents accidental dismissal when scrolling through filter options.
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only track swipe if it started in the drag handle zone (top 48px of sheet)
    // or if the scrollable content is already scrolled to the top
    const sheetTop = sheetRef.current?.getBoundingClientRect().top ?? 0;
    const touchY = e.touches[0].clientY;
    const relativeY = touchY - sheetTop;
    const scrollTop = scrollRef.current?.scrollTop ?? 0;

    if (relativeY < 48 || scrollTop === 0) {
      touchStartY.current = touchY;
    } else {
      touchStartY.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    // Require 120px+ swipe down (was 80px, too sensitive)
    if (deltaY > 120) setIsOpen(false);
    touchStartY.current = null;
  }, []);

  // Expand dispensary list to fullscreen when user starts scrolling it
  const handleDispoScrollIntent = useCallback(() => {
    if (!dispoFullscreen) {
      setDispoFullscreen(true);
      trackEvent('filter_change', undefined, { action: 'dispo_fullscreen_open' });
    }
  }, [dispoFullscreen]);

  return (
    <>
      {/* Trigger button — styled as a chip to match category pills */}
      <button
        onClick={() => setIsOpen(true)}
        aria-label={`Filters${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ''}`}
        className={`relative flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-full text-xs font-medium whitespace-nowrap transition-all ${
          activeFilterCount > 0
            ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
            : 'bg-slate-800/70 text-slate-300 hover:text-white border border-slate-600/50 hover:border-purple-500/30'
        }`}
      >
        <SlidersHorizontal className="w-4 h-4" />
        {activeFilterCount > 0 ? activeFilterCount : 'Filter'}
      </button>

      {/* Overlay — rendered via portal */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Filter deals">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 animate-in fade-in duration-200"
            style={{ WebkitBackdropFilter: 'blur(8px) saturate(1.2)', backdropFilter: 'blur(8px) saturate(1.2)' }}
            onClick={() => setIsOpen(false)}
          />

          {/* Sheet */}
          <div
            ref={sheetRef}
            className={`absolute bottom-0 left-0 right-0 sm:left-auto sm:top-0 sm:bottom-0 sm:w-[380px] sm:max-h-none sm:h-full border-t sm:border-t-0 sm:border-l rounded-t-3xl sm:rounded-none flex flex-col transition-[max-height] duration-300 ease-out ${
              dispoFullscreen ? 'max-h-[95vh]' : 'max-h-[80vh]'
            }`}
            style={{ backgroundColor: 'rgba(12, 14, 28, 0.98)', borderColor: 'rgba(120, 100, 200, 0.1)', WebkitBackdropFilter: 'blur(32px) saturate(1.3)', backdropFilter: 'blur(32px) saturate(1.3)' }}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Drag handle (mobile) — hidden in dispo fullscreen */}
            {!dispoFullscreen && (
              <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-slate-700" />
              </div>
            )}

            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'rgba(120, 100, 200, 0.08)' }}>
              {dispoFullscreen ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDispoFullscreen(false)}
                    className="p-1.5 -ml-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors sm:hidden"
                    aria-label="Back to filters"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-lg font-semibold text-white">Dispensaries</h2>
                  {filters.dispensaryIds.length > 0 && (
                    <span className="text-sm text-purple-400">({filters.dispensaryIds.length})</span>
                  )}
                </div>
              ) : (
                <h2 className="text-lg font-semibold text-white">Filters</h2>
              )}
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="Close filters"
                  className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Active filter chips — hidden in dispensary fullscreen */}
            {activeFilterCount > 0 && !dispoFullscreen && (
              <div className="flex-shrink-0 px-5 pt-3 pb-1">
                <div className="flex flex-wrap gap-1.5">
                  {filters.distanceRange !== 'all' && (
                    <button
                      onClick={() => onFiltersChange({ ...filters, distanceRange: 'all', quickFilter: 'none' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-full bg-blue-500/15 text-blue-400 text-xs font-medium"
                      aria-label="Remove distance filter"
                    >
                      {DISTANCE_OPTIONS.find(d => d.id === filters.distanceRange)?.label}
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {filters.weightFilters.length > 0 && (
                    <button
                      onClick={() => onFiltersChange({ ...filters, weightFilters: [] })}
                      className="flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] max-w-full rounded-full bg-cyan-500/15 text-cyan-400 text-xs font-medium"
                      aria-label="Remove weight filter"
                    >
                      <span className="truncate">{filters.weightFilters.join(', ')}</span>
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {filters.dispensaryIds.length > 0 && (
                    <button
                      onClick={() => onFiltersChange({ ...filters, dispensaryIds: [], quickFilter: 'none' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-full bg-blue-500/15 text-blue-400 text-xs font-medium"
                      aria-label="Remove dispensary filter"
                    >
                      {filters.dispensaryIds.length} store{filters.dispensaryIds.length !== 1 ? 's' : ''}
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Scrollable content */}
            <div ref={scrollRef} className={`flex-1 min-h-0 px-5 py-4 overscroll-contain ${
              dispoFullscreen ? 'flex flex-col' : 'overflow-y-auto space-y-6'
            }`}>
              {/* Location prompt — shown when user needs to set location (triggered from sort dropdown) */}
              {locationPrompt !== 'hidden' && !dispoFullscreen && (
                <section>
                  <div className="rounded-xl bg-slate-800/80 border border-slate-700/50 p-4">
                    {locationPrompt === 'choose' && (
                      <div className="space-y-2.5">
                        <p className="text-xs text-slate-400 mb-3">Set your location to sort by distance</p>
                        <button
                          onClick={handleUseLocation}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-purple-500/15 text-purple-400 text-sm font-medium hover:bg-purple-500/25 transition-colors"
                        >
                          <Navigation className="w-4 h-4" />
                          Use my location
                        </button>
                        <button
                          onClick={() => {
                            setLocationPrompt('zip');
                            setTimeout(() => zipInputRef.current?.focus(), 100);
                          }}
                          className="w-full text-center text-xs text-slate-500 hover:text-slate-400 transition-colors py-1"
                        >
                          Or enter a zip code
                        </button>
                      </div>
                    )}
                    {locationPrompt === 'requesting' && (
                      <div className="flex items-center justify-center gap-2 py-3 text-sm text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Requesting location...
                      </div>
                    )}
                    {locationPrompt === 'zip' && (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-400">Enter your Las Vegas area zip code</p>
                        <div className="flex gap-2">
                          <input
                            ref={zipInputRef}
                            type="text"
                            inputMode="numeric"
                            maxLength={5}
                            value={zipInput}
                            onChange={(e) => { setZipInput(e.target.value.replace(/\D/g, '')); setZipError(''); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleZipSubmit(); }}
                            placeholder="89101"
                            className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50"
                          />
                          <button
                            onClick={handleZipSubmit}
                            className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 text-sm font-medium hover:bg-purple-500/30 transition-colors"
                          >
                            Go
                          </button>
                        </div>
                        {zipError && <p className="text-xs text-red-400">{zipError}</p>}
                        <button
                          onClick={() => { setLocationPrompt('choose'); setZipInput(''); setZipError(''); }}
                          className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
                        >
                          Back
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Weight / Size — universal options (hidden in dispo fullscreen) */}
              {!dispoFullscreen && <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Size / Weight
                  {filters.weightFilters.length > 0 && (
                    <button
                      onClick={() => onFiltersChange({ ...filters, weightFilters: [] })}
                      className="ml-2 text-[10px] text-cyan-400/60 hover:text-cyan-400 normal-case font-normal"
                    >
                      clear
                    </button>
                  )}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {WEIGHT_OPTIONS.map((opt) => {
                    const isSelected = filters.weightFilters.includes(opt.id);
                    return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        const next = isSelected
                          ? filters.weightFilters.filter(w => w !== opt.id)
                          : [...filters.weightFilters, opt.id];
                        onFiltersChange({ ...filters, weightFilters: next });
                        if (next.length > 0) trackEvent('filter_change', undefined, { weights: next.join(',') });
                      }}
                      className={`px-3.5 py-2 min-h-[44px] rounded-full text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                    );
                  })}
                </div>
              </section>}

              {/* Location & Dispensary (collapsible — in fullscreen mode, only dispensary shows) */}
              <section className={dispoFullscreen ? 'flex flex-col flex-1 min-h-0' : ''}>
                {!dispoFullscreen && (
                <button
                  onClick={() => setLocationOpen(!locationOpen)}
                  className="flex items-center justify-between w-full"
                  aria-expanded={locationOpen}
                  aria-label="Toggle location filters"
                >
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center">
                    <MapPin className="w-3 h-3 mr-1" />
                    Location & Dispensary
                  </h3>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${locationOpen ? 'rotate-180' : ''}`} />
                </button>
                )}
                {(locationOpen || dispoFullscreen) && (
                  <div className={dispoFullscreen ? 'flex flex-col flex-1 min-h-0' : 'mt-3 space-y-5'}>
                    {/* Distance — hidden in dispo fullscreen */}
                    {hasLocation && !dispoFullscreen && (
                      <div>
                        <p className="text-xs text-slate-500 mb-2">Distance</p>
                        <div className="grid grid-cols-2 gap-2">
                          {DISTANCE_OPTIONS.map((opt) => {
                            const isSelected = filters.distanceRange === opt.id;
                            return (
                              <button
                                key={opt.id}
                                onClick={() => onFiltersChange({
                                  ...filters,
                                  distanceRange: opt.id,
                                  sortBy: opt.id !== 'all' ? 'distance' : filters.sortBy,
                                  quickFilter: 'none',
                                })}
                                className={`px-3 py-2.5 rounded-xl text-left transition-all ${
                                  isSelected
                                    ? 'bg-blue-500/15 border border-blue-500/30'
                                    : 'bg-slate-800/50 border border-slate-700/50 hover:border-slate-600'
                                }`}
                              >
                                <p className={`text-xs font-medium ${isSelected ? 'text-blue-400' : 'text-slate-300'}`}>
                                  {opt.label}
                                </p>
                                <p className="text-[11px] text-slate-500">{opt.desc}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Dispensary — A-Z grouped with alphabet rail */}
                    <div className={dispoFullscreen ? 'flex flex-col flex-1 min-h-0' : ''}>
                      {/* Section header — hidden in fullscreen since the sheet header shows it */}
                      {!dispoFullscreen && (
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-slate-500">
                          Dispensary
                          {filters.dispensaryIds.length > 0 && (
                            <span className="ml-1 text-purple-400">({filters.dispensaryIds.length})</span>
                          )}
                        </p>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={selectAllDispensaries}
                            className="px-2 py-1 min-h-[32px] text-[11px] text-purple-400 hover:text-purple-300 transition-colors"
                            aria-label="Select all dispensaries"
                          >
                            All
                          </button>
                          <button
                            onClick={clearAllDispensaries}
                            className="px-2 py-1 min-h-[32px] text-[11px] text-slate-400 hover:text-slate-300 transition-colors"
                            aria-label="Clear dispensary selection"
                          >
                            None
                          </button>
                        </div>
                      </div>
                      )}
                      {/* All/None row in fullscreen mode */}
                      {dispoFullscreen && (
                        <div className="flex items-center justify-end gap-3 mb-2">
                          <button
                            onClick={selectAllDispensaries}
                            className="px-2 py-1 min-h-[32px] text-[11px] text-purple-400 hover:text-purple-300 transition-colors"
                            aria-label="Select all dispensaries"
                          >
                            All
                          </button>
                          <button
                            onClick={clearAllDispensaries}
                            className="px-2 py-1 min-h-[32px] text-[11px] text-slate-400 hover:text-slate-300 transition-colors"
                            aria-label="Clear dispensary selection"
                          >
                            None
                          </button>
                        </div>
                      )}
                      {/* Dispensary search */}
                      <div className="relative mb-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                        <input
                          type="text"
                          value={dispensarySearch}
                          onChange={(e) => setDispensarySearch(e.target.value)}
                          onFocus={handleDispoScrollIntent}
                          placeholder="Search dispensaries..."
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50 transition-colors"
                        />
                      </div>
                      {/* Coach mark for dispensary fullscreen */}
                      {!dispoFullscreen && (
                        <CoachMark id="dispo_expand" duration={2500}>
                          <p className="text-center text-[11px] text-purple-400/70 mb-1">Scroll to expand full list</p>
                        </CoachMark>
                      )}
                      {/* A-Z grouped list with alphabet rail */}
                      <div
                        ref={dispoListRef}
                        className={`relative flex rounded-lg bg-slate-800/50 overflow-hidden transition-[max-height] duration-300 ease-out ${
                          dispoFullscreen ? 'flex-1' : ''
                        }`}
                        style={dispoFullscreen ? undefined : { maxHeight: '220px' }}
                        onTouchStart={handleDispoScrollIntent}
                      >
                        {/* Scrollable dispensary list */}
                        <div className="flex-1 overflow-y-auto py-1 pr-6" id="dispensary-scroll-list">
                          {/* Recent dispensaries — shown when not searching */}
                          {!dispensarySearch && recentDispensaries.length > 0 && (
                            <div>
                              <div
                                className="sticky top-0 z-10 px-2 py-0.5 text-[10px] font-bold text-slate-400/70 uppercase"
                                style={{ backgroundColor: 'rgba(12, 14, 28, 0.95)' }}
                              >
                                Recent
                              </div>
                              {recentDispensaries.map((d) => {
                                const isChecked = filters.dispensaryIds.includes(d.id);
                                return (
                                  <label
                                    key={`recent-${d.id}`}
                                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-700/50 cursor-pointer transition-colors"
                                  >
                                    <div
                                      className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                                        isChecked
                                          ? 'bg-purple-500 border-purple-500'
                                          : 'border-slate-600 bg-slate-800'
                                      }`}
                                    >
                                      {isChecked && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleDispensary(d.id)}
                                      className="sr-only"
                                    />
                                    <span className="text-xs text-slate-300 truncate">{d.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                          {(() => {
                            // Group filtered dispensaries by first letter
                            const grouped: Record<string, typeof filteredDispensaries> = {};
                            for (const d of filteredDispensaries) {
                              const letter = (d.name[0] || '#').toUpperCase();
                              const key = /[A-Z]/.test(letter) ? letter : '#';
                              if (!grouped[key]) grouped[key] = [];
                              grouped[key].push(d);
                            }
                            const letters = Object.keys(grouped).sort();
                            return letters.map((letter) => (
                              <div key={letter}>
                                <div
                                  id={`disp-letter-${letter}`}
                                  className="sticky top-0 z-10 px-2 py-0.5 text-[10px] font-bold text-purple-400/70 uppercase"
                                  style={{ backgroundColor: 'rgba(12, 14, 28, 0.95)' }}
                                >
                                  {letter}
                                </div>
                                {grouped[letter].map((d) => {
                                  const isChecked = filters.dispensaryIds.includes(d.id);
                                  return (
                                    <label
                                      key={d.id}
                                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-700/50 cursor-pointer transition-colors"
                                    >
                                      <div
                                        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                                          isChecked
                                            ? 'bg-purple-500 border-purple-500'
                                            : 'border-slate-600 bg-slate-800'
                                        }`}
                                      >
                                        {isChecked && <Check className="w-3 h-3 text-white" />}
                                      </div>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => toggleDispensary(d.id)}
                                        className="sr-only"
                                      />
                                      <span className="text-xs text-slate-300 truncate">{d.name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            ));
                          })()}
                        </div>
                        {/* A-Z alphabet rail */}
                        {!dispensarySearch && (
                          <div className="absolute right-0 top-0 bottom-0 w-5 flex flex-col items-center justify-center py-1 gap-0"
                            style={{ backgroundColor: 'rgba(12, 14, 28, 0.8)' }}
                          >
                            {(() => {
                              const availableLetters = new Set(
                                dispensaries.map(d => {
                                  const l = (d.name[0] || '').toUpperCase();
                                  return /[A-Z]/.test(l) ? l : '#';
                                })
                              );
                              return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('').map((letter) => {
                                const hasItems = availableLetters.has(letter);
                                return (
                                  <button
                                    key={letter}
                                    onClick={() => {
                                      const el = document.getElementById(`disp-letter-${letter}`);
                                      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }}
                                    disabled={!hasItems}
                                    className={`text-[8px] leading-none py-px font-semibold transition-colors ${
                                      hasItems
                                        ? 'text-purple-400 hover:text-purple-300 active:text-white'
                                        : 'text-slate-700'
                                    }`}
                                  >
                                    {letter}
                                  </button>
                                );
                              });
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 p-4 border-t pb-[max(1rem,env(safe-area-inset-bottom))]" style={{ backgroundColor: 'rgba(12, 14, 28, 0.95)', borderColor: 'rgba(120, 100, 200, 0.08)' }}>
              <button
                onClick={() => setIsOpen(false)}
                className={`w-full py-3.5 min-h-[48px] font-semibold rounded-2xl transition-colors text-sm ${
                  filteredCount === 0
                    ? 'bg-slate-700 text-slate-400'
                    : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white shadow-lg shadow-purple-500/20'
                }`}
                style={filteredCount > 0 ? { boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(139, 92, 246, 0.2)' } : undefined}
              >
                {filteredCount === 0 ? 'No deals match' : `Show ${filteredCount} deal${filteredCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
