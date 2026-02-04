export const DISCOVERY_MILESTONES = [
  { count: 10, message: "Getting warmer", icon: "fire" },
  { count: 20, message: "Deal hunter", icon: "target" },
  { count: 30, message: "Halfway there!", icon: "muscle" },
  { count: 50, message: "Power user!", icon: "bolt" },
  { count: 75, message: "Almost done!", icon: "flag" },
] as const;

export const FINDS_MILESTONES = [5, 10, 25, 50] as const;

export const FINDS_MESSAGES: Record<number, string> = {
  5: "First 5! You've got taste",
  10: "Double digits! Deal hunter status",
  25: "25 finds! You're a regular",
  50: "50 finds! Legend status",
} as const;

export const SAVE_MILESTONES = [5, 10, 25, 50, 100] as const;

export const ALPHABET = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const CATEGORY_FILTERS = [
  { id: 'all' as const, label: 'All' },
  { id: 'flower' as const, label: 'Flower' },
  { id: 'vape' as const, label: 'Vape' },
  { id: 'edible' as const, label: 'Edibles' },
  { id: 'concentrate' as const, label: 'Concentrates' },
  { id: 'preroll' as const, label: 'Pre-Rolls' },
] as const;

export const TOAST_DURATIONS = {
  short: 2000,
  medium: 3000,
  long: 4000,
} as const;
