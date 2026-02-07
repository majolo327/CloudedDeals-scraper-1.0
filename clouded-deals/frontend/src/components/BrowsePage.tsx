'use client';

import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, ShieldCheck, Star, MapPin, Clock } from 'lucide-react';
import { ALPHABET } from '@/utils/constants';
import { filterBrandsByQuery, sortBrandsByName, groupBrandsByLetter, countDealsByBrand } from '@/utils/brandUtils';
import { BRANDS } from '@/data/brands';
import type { Brand, Deal } from '@/types';
import type { BrowseDispensary } from '@/lib/api';

type BrowseTab = 'brands' | 'dispensaries';

interface BrowsePageProps {
  deals?: Deal[];
  dispensaries?: BrowseDispensary[];
  onSelectBrand?: (brandName: string) => void;
  onSelectDispensary?: (dispensaryName: string) => void;
}

export function BrowsePage({ deals = [], dispensaries = [], onSelectBrand, onSelectDispensary }: BrowsePageProps) {
  const [activeTab, setActiveTab] = useState<BrowseTab>('brands');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);

  // Brand deal counts
  const brandDealCounts = useMemo(() => countDealsByBrand(deals), [deals]);

  // Brands
  const filteredBrands = useMemo(() => {
    const sorted = sortBrandsByName(BRANDS);
    return filterBrandsByQuery(sorted, searchQuery);
  }, [searchQuery]);

  const groupedBrands = useMemo(() => groupBrandsByLetter(filteredBrands), [filteredBrands]);

  const activeLetters = useMemo(() => {
    return ALPHABET.filter((l) => groupedBrands[l]?.length);
  }, [groupedBrands]);

  // Dispensary counts
  const totalDispensaries = dispensaries.length;
  const withDeals = dispensaries.filter((d) => d.deal_count > 0).length;

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
              {totalDispensaries > 0 && (
                <span className="ml-1.5 text-[10px] text-slate-500 font-normal">{totalDispensaries}</span>
              )}
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
            dispensaries={dispensaries}
            totalCount={totalDispensaries}
            withDealsCount={withDeals}
            onSelectDispensary={onSelectDispensary}
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

interface DispensariesTabProps {
  dispensaries: BrowseDispensary[];
  totalCount: number;
  withDealsCount: number;
  onSelectDispensary?: (dispensaryName: string) => void;
}

function DispensariesTab({
  dispensaries,
  totalCount,
  withDealsCount,
  onSelectDispensary,
}: DispensariesTabProps) {
  const [dispSearch, setDispSearch] = useState('');

  const filtered = useMemo(() => {
    if (!dispSearch.trim()) return dispensaries;
    const q = dispSearch.toLowerCase();
    return dispensaries.filter(
      (d) => d.name.toLowerCase().includes(q) || d.city.toLowerCase().includes(q) || d.address.toLowerCase().includes(q),
    );
  }, [dispensaries, dispSearch]);

  const withDeals = filtered.filter((d) => d.deal_count > 0);
  const comingSoon = filtered.filter((d) => d.deal_count === 0);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-slate-400">
          <span className="text-white font-semibold">{totalCount}</span> dispensaries across Nevada
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

      {/* Dispensaries with deals */}
      {withDeals.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 px-1">
            Live Deals
          </h3>
          <div className="space-y-2">
            {withDeals.map((disp) => (
              <button
                key={disp.id}
                onClick={() => onSelectDispensary?.(disp.name)}
                className="w-full glass rounded-lg px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-800/30 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-slate-200 truncate">{disp.name}</p>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-2.5 h-2.5 text-slate-600 shrink-0" />
                    <p className="text-xs text-slate-500 truncate">
                      {disp.address}{disp.city ? `, ${disp.city}` : ''}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-purple-400 font-medium shrink-0">
                  {disp.deal_count} deal{disp.deal_count !== 1 ? 's' : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dispensaries without deals (Coming Soon) */}
      {comingSoon.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 px-1">
            Coming Soon
          </h3>
          <div className="space-y-1.5">
            {comingSoon.map((disp) => (
              <div
                key={disp.id}
                className="glass rounded-lg px-4 py-2.5 flex items-center justify-between gap-3 opacity-70"
              >
                <div className="min-w-0">
                  <p className="text-sm text-slate-300 truncate">{disp.name}</p>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-2.5 h-2.5 text-slate-600 shrink-0" />
                    <p className="text-[11px] text-slate-600 truncate">
                      {disp.address}{disp.city ? `, ${disp.city}` : ''}
                    </p>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-[10px] text-slate-600 font-medium shrink-0">
                  <Clock className="w-3 h-3" />
                  Soon
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <p className="text-center text-sm text-slate-500 py-8">No dispensaries match your search.</p>
      )}
    </div>
  );
}
