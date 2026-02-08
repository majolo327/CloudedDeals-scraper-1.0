import type { Dispensary, Deal, DispensaryZone } from '@/types';

export function countDealsByDispensary(deals: Deal[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const deal of deals) {
    const id = deal.dispensary?.id;
    if (id) {
      counts[id] = (counts[id] || 0) + 1;
    }
  }
  return counts;
}

export function sortDispensariesByName(dispensaries: Dispensary[]): Dispensary[] {
  return [...dispensaries].sort((a, b) => {
    // Scraped dispensaries first
    const aScraped = a.scraped !== false;
    const bScraped = b.scraped !== false;
    if (aScraped !== bScraped) return aScraped ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function filterDispensariesByQuery(dispensaries: Dispensary[], query: string): Dispensary[] {
  const q = query.toLowerCase().trim();
  if (!q) return dispensaries;
  return dispensaries.filter(
    (d) =>
      d.name.toLowerCase().includes(q) ||
      d.address.toLowerCase().includes(q),
  );
}

export function filterDispensariesByZone(
  dispensaries: Dispensary[],
  zone: DispensaryZone | 'all',
): Dispensary[] {
  if (zone === 'all') return dispensaries;
  return dispensaries.filter((d) => d.zone === zone);
}

export function groupDispensariesByLetter(dispensaries: Dispensary[]): Record<string, Dispensary[]> {
  const grouped: Record<string, Dispensary[]> = {};
  for (const disp of dispensaries) {
    const letter = disp.name[0]?.toUpperCase() || '#';
    if (!grouped[letter]) grouped[letter] = [];
    grouped[letter].push(disp);
  }
  return grouped;
}
