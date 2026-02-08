'use client';

import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, ShieldCheck, MapPin, ExternalLink, Star } from 'lucide-react';
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

type BrowseTab = 'brands' | 'dispensaries';

interface BrowsePageProps {
  deals?: Deal[];
  dispensaries?: BrowseDispensary[];
  onSelectBrand?: (brandName: string) => void;
  onSelectDispensary?: (dispensaryName: string) => void;
}

export function BrowsePage({ deals = [], onSelectBrand, onSelectDispensary }: BrowsePageProps) {
  const [activeTab, setActiveTab] = useState<BrowseTab>('brands');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);

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

  const toggleBrand = (brandId: string) => {
    setExpandedBrand((prev) => (prev === brandId ? null : brandId));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Tab bar */}
      <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-purple-500/10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-6 h-12">
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
            <button
              onClick={() => setActiveTab('dispensaries')}
              className={`relative text-sm font-medium transition-colors ${
                activeTab === 'dispensaries' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Dispensaries
              <span className="ml-1.5 text-[10px] text-slate-500 font-normal">{DISPENSARIES.length}</span>
              {activeTab === 'dispensaries' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-full" />
              )}
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'brands' ? (
          <BrandsTab
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            groupedBrands={groupedBrands}
            activeLetters={activeLetters}
            expandedBrand={expandedBrand}
            onToggleBrand={toggleBrand}
            onScrollToLetter={(l) => scrollToLetter(l, 'brand')}
            brandDealCounts={brandDealCounts}
            onSelectBrand={onSelectBrand}
          />
        ) : (
          <DispensariesTab
            dealCounts={dispensaryDealCounts}
            onSelectDispensary={onSelectDispensary}
            onScrollToLetter={(l) => scrollToLetter(l, 'disp')}
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
  expandedBrand: string | null;
  onToggleBrand: (id: string) => void;
  onScrollToLetter: (letter: string) => void;
  brandDealCounts: Record<string, number>;
  onSelectBrand?: (brandName: string) => void;
}

function BrandsTab({
  searchQuery,
  onSearchChange,
  groupedBrands,
  activeLetters,
  expandedBrand,
  onToggleBrand,
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

      {/* Brand list */}
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
                {brands.map((brand) => (
                  <BrandRow
                    key={brand.id}
                    brand={brand}
                    isExpanded={expandedBrand === brand.id}
                    onToggle={() => onToggleBrand(brand.id)}
                    dealCount={brandDealCounts[brand.name] || 0}
                    onViewDeals={onSelectBrand ? () => onSelectBrand(brand.name) : undefined}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BrandRow({
  brand,
  isExpanded,
  onToggle,
  dealCount,
  onViewDeals,
}: {
  brand: Brand;
  isExpanded: boolean;
  onToggle: () => void;
  dealCount: number;
  onViewDeals?: () => void;
}) {
  const tierColor: Record<string, string> = {
    premium: 'text-amber-400',
    established: 'text-emerald-400',
    local: 'text-blue-400',
    value: 'text-slate-400',
  };

  const tierLabel: Record<string, string> = {
    premium: 'Premium',
    established: 'Established',
    local: 'Local',
    value: 'Value',
  };

  return (
    <div className="glass rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-slate-400">
              {brand.name[0]}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-slate-200 truncate">{brand.name}</p>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${tierColor[brand.tier] || 'text-slate-500'} bg-slate-800/50`}>
                {tierLabel[brand.tier] || brand.tier}
              </span>
            </div>
            {dealCount > 0 && (
              <p className="text-[10px] text-purple-400">
                {dealCount} deal{dealCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-800/50">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {brand.categories.map((cat) => (
                <span
                  key={cat}
                  className="rounded-full bg-slate-800/50 px-2 py-0.5 text-[10px] text-slate-400 capitalize"
                >
                  {cat}
                </span>
              ))}
            </div>
            {dealCount > 0 && onViewDeals && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewDeals();
                }}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-medium hover:bg-purple-500/20 transition-colors"
              >
                View Deals
              </button>
            )}
          </div>
        </div>
      )}
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
  const [expandedDisp, setExpandedDisp] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = sortDispensariesByName(DISPENSARIES);
    result = filterDispensariesByZone(result, activeZone);
    result = filterDispensariesByQuery(result, dispSearch);
    return result;
  }, [dispSearch, activeZone]);

  const grouped = useMemo(() => groupDispensariesByLetter(filtered), [filtered]);

  const activeLetters = useMemo(() => {
    return ALPHABET.filter((l) => grouped[l]?.length);
  }, [grouped]);

  const withDealsCount = useMemo(() => {
    return DISPENSARIES.filter((d) => (dealCounts[d.id] || 0) > 0).length;
  }, [dealCounts]);

  const toggleDisp = (dispId: string) => {
    setExpandedDisp((prev) => (prev === dispId ? null : dispId));
  };

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-slate-400">
          <span className="text-white font-semibold">{DISPENSARIES.length}</span> dispensaries across Nevada
        </p>
        <p className="text-xs text-purple-400">
          {withDealsCount} with live deals
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

      {/* Zone filter chips */}
      <div className="flex gap-2">
        {ZONE_FILTERS.map((zone) => (
          <button
            key={zone.id}
            onClick={() => setActiveZone(zone.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeZone === zone.id
                ? 'bg-purple-500/20 text-purple-400'
                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
            }`}
          >
            {zone.label}
          </button>
        ))}
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

      {/* Dispensary list */}
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
                {disps.map((disp) => (
                  <DispensaryRow
                    key={disp.id}
                    dispensary={disp}
                    dealCount={dealCounts[disp.id] || 0}
                    isExpanded={expandedDisp === disp.id}
                    onToggle={() => toggleDisp(disp.id)}
                    onViewDeals={onSelectDispensary ? () => onSelectDispensary(disp.name) : undefined}
                  />
                ))}
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
  isExpanded,
  onToggle,
  onViewDeals,
}: {
  dispensary: Dispensary;
  dealCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  onViewDeals?: () => void;
}) {
  const zone = dispensary.zone || 'local';
  const zoneStyle = ZONE_COLORS[zone];
  const isVerified = dispensary.tier === 'verified' || dispensary.tier === 'premium';

  return (
    <div className="glass rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-slate-400">
              {dispensary.name[0]}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-slate-200 truncate">{dispensary.name}</p>
              {isVerified && (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              )}
              {dispensary.tier === 'premium' && (
                <Star className="w-3 h-3 text-amber-400 shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-2.5 h-2.5 text-slate-600 shrink-0" />
              <p className="text-[10px] text-slate-500 truncate">{dispensary.address}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${zoneStyle.bg} ${zoneStyle.text}`}>
            {zone}
          </span>
          <span className={`text-xs font-medium ${dealCount > 0 ? 'text-purple-400' : 'text-slate-600'}`}>
            {dealCount} deal{dealCount !== 1 ? 's' : ''}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-800/50">
          {dealCount > 0 && onViewDeals ? (
            <div className="flex items-center justify-between gap-2">
              <a
                href={dispensary.menu_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                View menu
              </a>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewDeals();
                }}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-medium hover:bg-purple-500/20 transition-colors"
              >
                View {dealCount} Deal{dealCount !== 1 ? 's' : ''}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-slate-500">No deals today — check back tomorrow morning.</p>
              <a
                href={dispensary.menu_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800/50 text-slate-400 text-xs font-medium hover:bg-slate-800 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Menu
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
