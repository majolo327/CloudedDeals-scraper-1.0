export const DISCOVERY_MILESTONES = [5, 10, 25, 50, 100] as const;

export const FINDS_MILESTONES = [3, 7, 14, 30] as const;

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const CATEGORY_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'flower', label: 'Flower' },
  { key: 'concentrate', label: 'Concentrates' },
  { key: 'vape', label: 'Vapes' },
  { key: 'edible', label: 'Edibles' },
  { key: 'preroll', label: 'Pre-Rolls' },
] as const;

export const TOAST_DURATIONS: Record<string, number> = {
  saved: 2000,
  removed: 2000,
  success: 2500,
  streak: 4000,
  milestone: 4000,
  error: 5000,
  info: 3000,
};
