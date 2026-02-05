'use client';

import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, ShieldCheck, Star, MapPin } from 'lucide-react';
import { ALPHABET } from '@/utils/constants';
import { filterBrandsByQuery, sortBrandsByName, groupBrandsByLetter, countDealsByBrand } from '@/utils/brandUtils';
import { BRANDS } from '@/data/brands';
import { DISPENSARIES } from '@/data/dispensaries';
import type { Brand, Deal, Dispensary } from '@/types';

type BrowseTab = 'brands' | 'dispensaries';

interface BrowsePageProps {
  deals?: Deal[];
}

function groupDispensariesByLetter(dispensaries: Dispensary[]): Record<string, Dispensary[]> {
  const grouped: Record<string, Dispensary[]> = {};
  for (const disp of dispensaries) {
    const letter = disp.name[0]?.toUpperCase() || '#';
    if (!grouped[letter]) grouped[letter] = [];
    grouped[letter].push(disp);
  }
  return grouped;
}

export function BrowsePage({ deals = [] }: BrowsePageProps) {
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

  // Dispensaries - sorted alphabetically
  const sortedDispensaries = useMemo(() => {
    return [...DISPENSARIES].sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const groupedDispensaries = useMemo(() => groupDispensariesByLetter(sortedDispensaries), [sortedDispensaries]);

  const activeDispLetters = useMemo(() => {
    return ALPHABET.filter((l) => groupedDispensaries[l]?.length);
  }, [groupedDispensaries]);

  // Dispensary deal counts (by dispensary name)
  const dispensaryDealCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const deal of deals) {
      const name = deal.dispensary.name;
      counts[name] = (counts[name] || 0) + 1;
    }
    return counts;
  }, [deals]);

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
          />
        ) : (
          <DispensariesTab
            groupedDispensaries={groupedDispensaries}
            activeLetters={activeDispLetters}
            onScrollToLetter={(l) => scrollToLetter(l, 'disp')}
            dispensaryDealCounts={dispensaryDealCounts}
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
}: {
  brand: Brand;
  isExpanded: boolean;
  onToggle: () => void;
  dealCount: number;
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
        </div>
      )}
    </div>
  );
}

// ---- Dispensaries Tab ----

interface DispensariesTabProps {
  groupedDispensaries: Record<string, Dispensary[]>;
  activeLetters: string[];
  onScrollToLetter: (letter: string) => void;
  dispensaryDealCounts: Record<string, number>;
}

function DispensariesTab({
  groupedDispensaries,
  activeLetters,
  onScrollToLetter,
  dispensaryDealCounts,
}: DispensariesTabProps) {
  return (
    <div className="space-y-4">
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
          const dispensaries = groupedDispensaries[letter];
          if (!dispensaries?.length) return null;
          return (
            <div key={letter} id={`disp-letter-${letter}`}>
              <h3 className="text-lg font-bold text-slate-500 mb-2">
                {letter}
              </h3>
              <div className="space-y-2">
                {dispensaries.map((disp) => {
                  const dealCount = dispensaryDealCounts[disp.name] || 0;
                  return (
                    <div
                      key={disp.id}
                      className="glass rounded-lg px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-medium text-slate-200 truncate">{disp.name}</p>
                          {disp.tier === 'verified' && (
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          )}
                          {disp.tier === 'premium' && (
                            <Star className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-2.5 h-2.5 text-slate-600 shrink-0" />
                          <p className="text-xs text-slate-500 truncate">{disp.address}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {dealCount > 0 && (
                          <span className="text-xs text-purple-400 font-medium">
                            {dealCount} deal{dealCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {disp.menu_url && (
                          <a
                            href={disp.menu_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-purple-400 hover:text-purple-300 font-medium"
                          >
                            Menu
                          </a>
                        )}
                      </div>
                    </div>
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
