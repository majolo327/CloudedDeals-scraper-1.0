'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { SlidersHorizontal, X, RotateCcw, Check, MapPin, ChevronDown, Navigation, Loader2 } from 'lucide-react';
import type { Category } from '@/types';
import { DISPENSARIES } from '@/data/dispensaries';
import { VALID_WEIGHTS_BY_CATEGORY } from '@/utils/weightNormalizer';
import { trackEvent } from '@/lib/analytics';
import { isVegasArea, getZipCoordinates } from '@/lib/zipCodes';
import type {
  UniversalFilterState,
  SortOption,
  DistanceRange,
} from '@/hooks/useUniversalFilters';
import { DEFAULT_UNIVERSAL_FILTERS } from '@/hooks/useUniversalFilters';

// Re-export for backwards compatibility with DealsPage
export type FilterState = UniversalFilterState;
export const DEFAULT_FILTERS = DEFAULT_UNIVERSAL_FILTERS;

const CATEGORIES: { id: Category; label: string; icon: string }[] = [
  { id: 'flower', label: 'Flower', icon: '🌿' },
  { id: 'concentrate', label: 'Concentrates', icon: '💎' },
  { id: 'vape', label: 'Vapes', icon: '💨' },
  { id: 'edible', label: 'Edibles', icon: '🍬' },
  { id: 'preroll', label: 'Pre-Rolls', icon: '🚬' },
];

const PRICE_RANGES: { id: string; label: string; min: number; max: number }[] = [
  { id: 'all', label: 'Any Price', min: 0, max: Infinity },
  { id: 'under10', label: 'Under $10', min: 0, max: 10 },
  { id: '10-20', label: '$10 – $20', min: 10, max: 20 },
  { id: '20-30', label: '$20 – $30', min: 20, max: 30 },
  { id: '30-50', label: '$30 – $50', min: 30, max: 50 },
  { id: '50+', label: '$50+', min: 50, max: Infinity },
];

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'deal_score', label: 'Best Deal (Curated)' },
  { id: 'price_asc', label: 'Price: Low to High' },
  { id: 'price_desc', label: 'Price: High to Low' },
  { id: 'discount', label: 'Biggest Discount' },
  { id: 'distance', label: 'Nearest First' },
];

const DISTANCE_OPTIONS: { id: DistanceRange; label: string; desc: string }[] = [
  { id: 'all', label: 'Any Distance', desc: 'Show all deals' },
  { id: 'near', label: 'Near You', desc: 'Within 5 miles' },
  { id: 'nearby', label: 'Nearby', desc: 'Within 10 miles' },
  { id: 'across_town', label: 'Across Town', desc: 'Within 15 miles' },
];

/** Weight options that adapt to selected category. */
function getWeightOptions(selectedCategories: Category[]): { id: string; label: string }[] {
  const options: { id: string; label: string }[] = [{ id: 'all', label: 'Any Size' }];

  // If exactly one category is selected, show weights for that category
  if (selectedCategories.length === 1) {
    const cat = selectedCategories[0];
    const config = VALID_WEIGHTS_BY_CATEGORY[cat];
    if (config) {
      for (const w of config.commonWeights) {
        const display = `${w}${config.unit}`;
        options.push({ id: display, label: display });
      }
    }
    return options;
  }

  // No category or multiple: show universal common weights
  const universalWeights = ['0.5g', '1g', '3.5g', '7g', '14g', '28g', '100mg', '200mg'];
  for (const w of universalWeights) {
    options.push({ id: w, label: w });
  }
  return options;
}

export function getPriceRangeBounds(rangeId: string): { min: number; max: number } {
  const range = PRICE_RANGES.find((r) => r.id === rangeId);
  return range ? { min: range.min, max: range.max } : { min: 0, max: Infinity };
}

type LocationPromptState = 'hidden' | 'choose' | 'requesting' | 'zip';

interface FilterSheetProps {
  filters: UniversalFilterState;
  onFiltersChange: (filters: UniversalFilterState) => void;
  filteredCount: number;
  hasLocation?: boolean;
  onReset?: () => void;
  activeFilterCount?: number;
  onLocationSet?: () => void;
}

export function FilterSheet({
  filters,
  onFiltersChange,
  filteredCount,
  hasLocation = false,
  onReset,
  activeFilterCount: externalActiveCount,
  onLocationSet,
}: FilterSheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationPrompt, setLocationPrompt] = useState<LocationPromptState>('hidden');
  const [zipInput, setZipInput] = useState('');
  const [zipError, setZipError] = useState('');
  const zipInputRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

  const dispensaries = useMemo(() => {
    return DISPENSARIES
      .map((d) => ({ id: d.id, name: d.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const weightOptions = useMemo(() => getWeightOptions(filters.categories), [filters.categories]);

  const activeFilterCount = externalActiveCount ?? [
    filters.categories.length > 0,
    filters.dispensaryIds.length > 0,
    filters.priceRange !== 'all',
    filters.minDiscount > 0,
    filters.distanceRange !== 'all',
    filters.weightFilter !== 'all',
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

  const toggleCategory = (cat: Category) => {
    const next = filters.categories.includes(cat)
      ? filters.categories.filter((c) => c !== cat)
      : [...filters.categories, cat];
    onFiltersChange({ ...filters, categories: next, quickFilter: 'none' });
    trackEvent('filter_change', undefined, { categories: next.join(',') });
  };

  const toggleDispensary = (id: string) => {
    const next = filters.dispensaryIds.includes(id)
      ? filters.dispensaryIds.filter((d) => d !== id)
      : [...filters.dispensaryIds, id];
    onFiltersChange({ ...filters, dispensaryIds: next, quickFilter: 'none' });
  };

  const selectAllDispensaries = () => {
    const all = dispensaries.map((d) => d.id);
    onFiltersChange({ ...filters, dispensaryIds: all, quickFilter: 'none' });
  };

  const clearAllDispensaries = () => {
    onFiltersChange({ ...filters, dispensaryIds: [], quickFilter: 'none' });
  };

  // Sort option click — if "distance" is selected without location, prompt for it
  const handleSortSelect = useCallback((optId: SortOption) => {
    if (optId === 'distance' && !hasLocation) {
      setLocationPrompt('choose');
      return;
    }
    onFiltersChange({ ...filters, sortBy: optId });
    setSortOpen(false);
  }, [filters, hasLocation, onFiltersChange]);

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
      setSortOpen(false);
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
    setSortOpen(false);
    onLocationSet?.();
    trackEvent('filter_change', undefined, { action: 'location_set', method: 'zip', zip });
  }, [zipInput, filters, onFiltersChange, onLocationSet]);

  // Auto-expand location section when user has location or active location filters
  useEffect(() => {
    if (hasLocation || filters.distanceRange !== 'all' || filters.dispensaryIds.length > 0) {
      setLocationOpen(true);
    }
  }, [hasLocation, filters.distanceRange, filters.dispensaryIds]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Swipe-to-close on mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (deltaY > 80) setIsOpen(false);
    touchStartY.current = null;
  }, []);

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="relative flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
      >
        <SlidersHorizontal className="w-4 h-4" />
        <span className="hidden sm:inline">Filters</span>
        {activeFilterCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-purple-500 text-white text-[11px] font-bold flex items-center justify-center">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Overlay — rendered via portal */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[60]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsOpen(false)}
          />

          {/* Sheet */}
          <div
            ref={sheetRef}
            className="absolute bottom-0 left-0 right-0 sm:left-auto sm:top-0 sm:bottom-0 sm:w-[380px] max-h-[80vh] sm:max-h-none sm:h-full bg-slate-900 border-t sm:border-t-0 sm:border-l border-slate-800 rounded-t-2xl sm:rounded-none flex flex-col"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Drag handle (mobile) */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-700" />
            </div>

            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-white">Filters</h2>
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
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Active filter chips */}
            {activeFilterCount > 0 && (
              <div className="flex-shrink-0 px-5 pt-3 pb-1">
                <div className="flex flex-wrap gap-1.5">
                  {filters.categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className="flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/15 text-purple-400 text-xs font-medium"
                    >
                      {cat}
                      <X className="w-2.5 h-2.5" />
                    </button>
                  ))}
                  {filters.priceRange !== 'all' && (
                    <button
                      onClick={() => onFiltersChange({ ...filters, priceRange: 'all', quickFilter: 'none' })}
                      className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-medium"
                    >
                      {PRICE_RANGES.find(r => r.id === filters.priceRange)?.label}
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                  {filters.minDiscount > 0 && (
                    <button
                      onClick={() => onFiltersChange({ ...filters, minDiscount: 0, quickFilter: 'none' })}
                      className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 text-xs font-medium"
                    >
                      {filters.minDiscount}%+ off
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                  {filters.distanceRange !== 'all' && (
                    <button
                      onClick={() => onFiltersChange({ ...filters, distanceRange: 'all', quickFilter: 'none' })}
                      className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/15 text-blue-400 text-xs font-medium"
                    >
                      {DISTANCE_OPTIONS.find(d => d.id === filters.distanceRange)?.label}
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                  {filters.weightFilter !== 'all' && (
                    <button
                      onClick={() => onFiltersChange({ ...filters, weightFilter: 'all' })}
                      className="flex items-center gap-1 px-2 py-1 rounded-full bg-cyan-500/15 text-cyan-400 text-xs font-medium"
                    >
                      {filters.weightFilter}
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                  {filters.dispensaryIds.length > 0 && (
                    <button
                      onClick={() => onFiltersChange({ ...filters, dispensaryIds: [], quickFilter: 'none' })}
                      className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/15 text-blue-400 text-xs font-medium"
                    >
                      {filters.dispensaryIds.length} store{filters.dispensaryIds.length !== 1 ? 's' : ''}
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Scrollable content */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-6 overscroll-contain">
              {/* Sort By (collapsible at top) */}
              <section>
                <button
                  onClick={() => setSortOpen(!sortOpen)}
                  className="flex items-center justify-between w-full"
                >
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Sort: <span className="text-slate-300 normal-case">{SORT_OPTIONS.find(o => o.id === filters.sortBy)?.label}</span>
                  </h3>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
                </button>
                {sortOpen && (
                  <div className="mt-2 space-y-0.5 rounded-xl bg-slate-800/50 p-1.5">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => handleSortSelect(opt.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
                          filters.sortBy === opt.id
                            ? 'bg-purple-500/15 text-purple-400'
                            : 'text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        {opt.label}
                        {opt.id === 'distance' && !hasLocation && (
                          <span className="ml-1.5 text-[10px] text-slate-600">(set location)</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Inline location prompt — shown when user taps "Nearest First" without location */}
                {locationPrompt !== 'hidden' && (
                    <div className="mt-3 rounded-xl bg-slate-800/80 border border-slate-700/50 p-4">
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
                  )}
              </section>

              {/* Category */}
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Category</h3>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => {
                    const isSelected = filters.categories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        onClick={() => toggleCategory(cat.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-full text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        <span className="text-sm">{cat.icon}</span>
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Location & Dispensary (collapsible) */}
              <section>
                <button
                  onClick={() => setLocationOpen(!locationOpen)}
                  className="flex items-center justify-between w-full"
                >
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center">
                    <MapPin className="w-3 h-3 mr-1" />
                    Location & Dispensary
                  </h3>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${locationOpen ? 'rotate-180' : ''}`} />
                </button>
                {locationOpen && (
                  <div className="mt-3 space-y-5">
                    {/* Distance */}
                    {hasLocation && (
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

                    {/* Dispensary */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-slate-500">Dispensary</p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={selectAllDispensaries}
                            className="text-[11px] text-purple-400 hover:text-purple-300 transition-colors"
                          >
                            Select All
                          </button>
                          <span className="text-slate-700">|</span>
                          <button
                            onClick={clearAllDispensaries}
                            className="text-[11px] text-slate-400 hover:text-slate-300 transition-colors"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1 max-h-40 overflow-y-auto rounded-lg bg-slate-800/50 p-2">
                        {dispensaries.map((d) => {
                          const isChecked = filters.dispensaryIds.includes(d.id);
                          return (
                            <label
                              key={d.id}
                              className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
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
                              <span className="text-sm text-slate-300 truncate">{d.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Price Range */}
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Price Range</h3>
                <div className="flex flex-wrap gap-2">
                  {PRICE_RANGES.map((range) => (
                    <button
                      key={range.id}
                      onClick={() => onFiltersChange({ ...filters, priceRange: range.id, quickFilter: 'none' })}
                      className={`px-3 py-2 min-h-[40px] rounded-full text-xs font-medium transition-all ${
                        filters.priceRange === range.id
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Weight / Size */}
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Size / Weight
                </h3>
                <div className="flex flex-wrap gap-2">
                  {weightOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        onFiltersChange({ ...filters, weightFilter: opt.id });
                        if (opt.id !== 'all') trackEvent('filter_change', undefined, { weight: opt.id });
                      }}
                      className={`px-3 py-2 min-h-[40px] rounded-full text-xs font-medium transition-all ${
                        filters.weightFilter === opt.id
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Min Discount (least used — at bottom) */}
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Min Discount: {filters.minDiscount > 0 ? `${filters.minDiscount}%+` : 'Any'}
                </h3>
                <input
                  type="range"
                  min={0}
                  max={70}
                  step={5}
                  value={filters.minDiscount}
                  onChange={(e) => onFiltersChange({ ...filters, minDiscount: Number(e.target.value), quickFilter: 'none' })}
                  className="w-full accent-purple-500"
                />
                <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                  <span>Any</span>
                  <span>70%+</span>
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 p-4 bg-slate-900/95 border-t border-slate-800 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full py-3 bg-purple-500 hover:bg-purple-400 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                Show {filteredCount} deal{filteredCount !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
