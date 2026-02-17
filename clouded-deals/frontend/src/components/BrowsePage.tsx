'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search, ShieldCheck, MapPin, ExternalLink, Star, Navigation } from 'lucide-react';
import { ALPHABET } from '@/utils/constants';
import { filterBrandsByQuery, sortBrandsByName, groupBrandsByLetter, countDealsByBrand } from '@/utils/brandUtils';
import {
  countDealsByDispensary,
  sortDispensariesByName,
  filterDispensariesByQuery,
  filterDispensariesByZone,
  groupDispensariesByLetter,
} from '@/utils/dispensaryUtils';
import { BRANDS } from '@/data/brands';
import { DISPENSARIES } from '@/data/dispensaries';
import type { Brand, Deal, Dispensary, DispensaryZone } from '@/types';
import type { BrowseDispensary } from '@/lib/api';
import { getStoredZip, getZipCoordinates, type ZipCoords } from '@/lib/zipCodes';
import { getDistanceMiles } from '@/utils';

type BrowseTab = 'brands' | 'dispensaries';

interface BrowsePageProps {
  deals?: Deal[];
  dispensaries?: BrowseDispensary[];
  onSelectBrand?: (brandName: string) => void;
  onSelectDispensary?: (dispensaryName: string) => void;
}

export function BrowsePage({ deals = [], onSelectBrand, onSelectDispensary }: BrowsePageProps) {
  const [activeTab, setActiveTab] = useState<BrowseTab>('dispensaries');
  const [searchQuery, setSearchQuery] = useState('');

  // Brand deal counts (from live Supabase deals)
  const brandDealCounts = useMemo(() => countDealsByBrand(deals), [deals]);

  // Brands (static data)
  const filteredBrands = useMemo(() => {
    const sorted = sortBrandsByName(BRANDS);
    return filterBrandsByQuery(sorted, searchQuery);
  }, [searchQuery]);

  const groupedBrands = useMemo(() => groupBrandsByLetter(filteredBrands), [filteredBrands]);

  const activeLetters = useMemo(() => {
    return ALPHABET.filter((l) => groupedBrands[l]?.length);
  }, [groupedBrands]);

  // Dispensary deal counts (from live Supabase deals, same pattern as brands)
  const dispensaryDealCounts = useMemo(() => countDealsByDispensary(deals), [deals]);

  const scrollToLetter = (letter: string, prefix: string) => {
    const el = document.getElementById(`${prefix}-letter-${letter}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: 'var(--surface-0)' }}>
      {/* Tab bar */}
      <div className="sticky top-0 z-40 backdrop-blur-2xl border-b border-purple-500/10" style={{ backgroundColor: 'rgba(10, 12, 28, 0.95)' }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-6 h-12">
            <button
              onClick={() => setActiveTab('dispensaries')}
              className={`relative text-sm font-medium transition-colors ${
                activeTab === 'dispensaries' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Dispensaries
              <span className="ml-1.5 text-[11px] text-slate-400 font-normal">{DISPENSARIES.length}</span>
              {activeTab === 'dispensaries' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('brands')}
              className={`relative text-sm font-medium transition-colors ${
                activeTab === 'brands' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Brands
              {activeTab === 'brands' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-full" />
              )}
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'dispensaries' ? (
          <DispensariesTab
            dealCounts={dispensaryDealCounts}
            onSelectDispensary={onSelectDispensary}
            onScrollToLetter={(l) => scrollToLetter(l, 'disp')}
          />
        ) : (
          <BrandsTab
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            groupedBrands={groupedBrands}
            activeLetters={activeLetters}
            onScrollToLetter={(l) => scrollToLetter(l, 'brand')}
            brandDealCounts={brandDealCounts}
            onSelectBrand={onSelectBrand}
          />
        )}
      </main>
    </div>
  );
}

// ---- Brands Tab ----

interface BrandsTabProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  groupedBrands: Record<string, Brand[]>;
  activeLetters: string[];
  onScrollToLetter: (letter: string) => void;
  brandDealCounts: Record<string, number>;
  onSelectBrand?: (brandName: string) => void;
}

function BrandsTab({
  searchQuery,
  onSearchChange,
  groupedBrands,
  activeLetters,
  onScrollToLetter,
  brandDealCounts,
  onSelectBrand,
}: BrandsTabProps) {
  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search brands..."
          className="w-full rounded-xl bg-slate-800/50 border border-slate-700/50 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50"
        />
      </div>

      {/* Letter navigation */}
      <div className="sticky top-12 z-30 bg-slate-950/95 backdrop-blur-sm py-2 -mx-4 px-4 overflow-x-auto scrollbar-hide">
        <div className="flex gap-1">
          {ALPHABET.map((letter) => {
            const isActive = activeLetters.includes(letter);
            return (
              <button
                key={letter}
                onClick={() => isActive && onScrollToLetter(letter)}
                disabled={!isActive}
                className={`w-7 h-7 shrink-0 rounded text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white hover:bg-purple-500/20 hover:text-purple-400'
                    : 'text-slate-700 cursor-not-allowed'
                }`}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </div>

      {/* Brand list — tap goes directly to deals */}
      <div className="space-y-6">
        {ALPHABET.map((letter) => {
          const brands = groupedBrands[letter];
          if (!brands?.length) return null;
          return (
            <div key={letter} id={`brand-letter-${letter}`}>
              <h3 className="text-lg font-bold text-slate-500 mb-2">
                {letter}
              </h3>
              <div className="space-y-1">
                {brands.map((brand) => {
                  const dealCount = brandDealCounts[brand.name] || 0;
                  return (
                    <button
                      key={brand.id}
                      onClick={() => onSelectBrand?.(brand.name)}
                      className="w-full glass rounded-lg flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-slate-400">
                            {brand.name[0]}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-200 truncate">{brand.name}</p>
                          {dealCount > 0 && (
                            <p className="text-[11px] text-purple-400">
                              {dealCount} deal{dealCount !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      {dealCount > 0 && (
                        <span className="text-xs text-purple-400/70 shrink-0">
                          View &rarr;
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Dispensaries Tab ----

const ZONE_FILTERS: { id: DispensaryZone | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'strip', label: 'Strip' },
  { id: 'downtown', label: 'Downtown' },
  { id: 'local', label: 'Local' },
];

const ZONE_COLORS: Record<DispensaryZone, { bg: string; text: string }> = {
  strip: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  downtown: { bg: 'bg-cyan-500/10', text: 'text-cyan-400' },
  local: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
};

interface DispensariesTabProps {
  dealCounts: Record<string, number>;
  onSelectDispensary?: (dispensaryName: string) => void;
  onScrollToLetter: (letter: string) => void;
}

function DispensariesTab({
  dealCounts,
  onSelectDispensary,
  onScrollToLetter,
}: DispensariesTabProps) {
  const [dispSearch, setDispSearch] = useState('');
  const [activeZone, setActiveZone] = useState<DispensaryZone | 'all'>('all');
  const [sortByDistance, setSortByDistance] = useState(false);
  const [userCoords, setUserCoords] = useState<ZipCoords | null>(null);

  useEffect(() => {
    const zip = getStoredZip();
    if (zip) {
      const coords = getZipCoordinates(zip);
      setUserCoords(coords);
    }
  }, []);

  const filtered = useMemo(() => {
    let result = sortDispensariesByName(DISPENSARIES);
    result = filterDispensariesByZone(result, activeZone);
    result = filterDispensariesByQuery(result, dispSearch);
    if (sortByDistance && userCoords) {
      result = [...result].sort((a, b) => {
        const distA = getDistanceMiles(userCoords.lat, userCoords.lng, a.latitude, a.longitude) ?? 999;
        const distB = getDistanceMiles(userCoords.lat, userCoords.lng, b.latitude, b.longitude) ?? 999;
        return distA - distB;
      });
    }
    return result;
  }, [dispSearch, activeZone, sortByDistance, userCoords]);

  const grouped = useMemo(() => groupDispensariesByLetter(filtered), [filtered]);

  const activeLetters = useMemo(() => {
    return ALPHABET.filter((l) => grouped[l]?.length);
  }, [grouped]);

  const scrapedCount = useMemo(() => {
    return DISPENSARIES.filter((d) => d.scraped !== false).length;
  }, []);

  const withDealsCount = useMemo(() => {
    return DISPENSARIES.filter((d) => (dealCounts[d.id] || 0) > 0).length;
  }, [dealCounts]);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-slate-400">
          <span className="text-white font-semibold">{DISPENSARIES.length}</span> dispensaries in Southern NV
        </p>
        <p className="text-xs text-purple-400">
          {scrapedCount} tracked · {withDealsCount} with live deals
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={dispSearch}
          onChange={(e) => setDispSearch(e.target.value)}
          placeholder="Search dispensaries..."
          className="w-full rounded-xl bg-slate-800/50 border border-slate-700/50 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50"
        />
      </div>

      {/* Zone filter chips + distance sort */}
      <div className="flex items-center gap-2 flex-wrap">
        {ZONE_FILTERS.map((zone) => (
          <button
            key={zone.id}
            onClick={() => { setActiveZone(zone.id); setSortByDistance(false); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeZone === zone.id && !sortByDistance
                ? 'bg-purple-500/20 text-purple-400'
                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
            }`}
          >
            {zone.label}
          </button>
        ))}
        {userCoords && (
          <button
            onClick={() => setSortByDistance(!sortByDistance)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              sortByDistance
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-300 border border-transparent'
            }`}
          >
            <Navigation className="w-3 h-3" />
            Nearest
          </button>
        )}
      </div>

      {/* Letter navigation */}
      <div className="sticky top-12 z-30 bg-slate-950/95 backdrop-blur-sm py-2 -mx-4 px-4 overflow-x-auto scrollbar-hide">
        <div className="flex gap-1">
          {ALPHABET.map((letter) => {
            const isActive = activeLetters.includes(letter);
            return (
              <button
                key={letter}
                onClick={() => isActive && onScrollToLetter(letter)}
                disabled={!isActive}
                className={`w-7 h-7 shrink-0 rounded text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white hover:bg-purple-500/20 hover:text-purple-400'
                    : 'text-slate-700 cursor-not-allowed'
                }`}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dispensary list — buttons inline, no expand/collapse */}
      <div className="space-y-6">
        {ALPHABET.map((letter) => {
          const disps = grouped[letter];
          if (!disps?.length) return null;
          return (
            <div key={letter} id={`disp-letter-${letter}`}>
              <h3 className="text-lg font-bold text-slate-500 mb-2">
                {letter}
              </h3>
              <div className="space-y-1">
                {disps.map((disp) => {
                  const dist = userCoords
                    ? getDistanceMiles(userCoords.lat, userCoords.lng, disp.latitude, disp.longitude)
                    : null;
                  return (
                    <DispensaryRow
                      key={disp.id}
                      dispensary={disp}
                      dealCount={dealCounts[disp.id] || 0}
                      onViewDeals={onSelectDispensary ? () => onSelectDispensary(disp.name) : undefined}
                      distance={dist}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-slate-500 py-8">No dispensaries match your search.</p>
      )}
    </div>
  );
}

function DispensaryRow({
  dispensary,
  dealCount,
  onViewDeals,
  distance,
}: {
  dispensary: Dispensary;
  dealCount: number;
  onViewDeals?: () => void;
  distance?: number | null;
}) {
  const zone = dispensary.zone || 'local';
  const zoneStyle = ZONE_COLORS[zone];
  const isVerified = dispensary.tier === 'verified' || dispensary.tier === 'premium';

  return (
    <div className="glass rounded-lg px-3 py-2.5">
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-slate-400">
            {dispensary.name[0]}
          </span>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-200 truncate">{dispensary.name}</p>
            {isVerified && (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            )}
            {dispensary.tier === 'premium' && (
              <Star className="w-3 h-3 text-amber-400 shrink-0" />
            )}
            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full capitalize ${zoneStyle.bg} ${zoneStyle.text}`}>
              {zone}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-2.5 h-2.5 text-slate-500 shrink-0" />
            <p className="text-[11px] text-slate-400 truncate">{dispensary.address}</p>
            {distance != null && (
              <span className="text-[11px] text-blue-400 shrink-0">{distance.toFixed(1)} mi</span>
            )}
          </div>
        </div>

        {/* Actions — inline with the row */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={dispensary.menu_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Menu
          </a>
          {onViewDeals && (
            <button
              onClick={onViewDeals}
              className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-medium hover:bg-purple-500/20 transition-colors"
            >
              {dealCount > 0 ? `${dealCount} Deal${dealCount !== 1 ? 's' : ''}` : 'Deals'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
