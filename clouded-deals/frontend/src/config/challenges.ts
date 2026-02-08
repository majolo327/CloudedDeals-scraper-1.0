export interface ChallengeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  badge: string;
  requirement: ChallengeRequirement;
}

export type ChallengeRequirement =
  | { action: 'interact'; count: number }
  | { action: 'save'; count: number; category?: string }
  | { action: 'save'; count: number; minHeat: number }
  | { action: 'save'; uniqueDispensaries: number }
  | { action: 'save'; sameBrand: number };

export const CHALLENGES: ChallengeDefinition[] = [
  {
    id: 'first_three',
    name: 'Get Started',
    description: 'Rate 3 deals to start building your feed',
    icon: '\uD83D\uDC4B',
    badge: '\uD83C\uDF31 Seedling',
    requirement: { action: 'interact', count: 3 },
  },
  {
    id: 'flower_explorer',
    name: 'Flower Power',
    description: 'Save 5 flower deals',
    icon: '\uD83C\uDF3F',
    badge: '\uD83C\uDF3F Flower Fan',
    requirement: { action: 'save', count: 5, category: 'flower' },
  },
  {
    id: 'edible_explorer',
    name: 'Green Thumb',
    description: 'Save 10 edible deals',
    icon: '\uD83C\uDF6C',
    badge: '\uD83C\uDF6C Edibles Expert',
    requirement: { action: 'save', count: 10, category: 'edible' },
  },
  {
    id: 'vape_explorer',
    name: 'Cloud Chaser',
    description: 'Save 5 vape deals',
    icon: '\uD83D\uDCA8',
    badge: '\uD83D\uDCA8 Cloud Chaser',
    requirement: { action: 'save', count: 5, category: 'vape' },
  },
  {
    id: 'concentrate_explorer',
    name: 'Dab Master',
    description: 'Save 5 concentrate deals',
    icon: '\uD83D\uDC8E',
    badge: '\uD83D\uDC8E Dab Master',
    requirement: { action: 'save', count: 5, category: 'concentrate' },
  },
  {
    id: 'deal_hunter',
    name: 'Deal Hunter',
    description: 'Save 10 deals with 50%+ off (steals)',
    icon: '\uD83C\uDFAF',
    badge: '\uD83C\uDFAF Deal Hunter',
    requirement: { action: 'save', count: 10, minHeat: 3 },
  },
  {
    id: 'variety_pack',
    name: 'Variety Pack',
    description: 'Save deals from 5 different dispensaries',
    icon: '\uD83D\uDDFA\uFE0F',
    badge: '\uD83D\uDDFA\uFE0F Explorer',
    requirement: { action: 'save', uniqueDispensaries: 5 },
  },
  {
    id: 'brand_loyal',
    name: 'Brand Loyal',
    description: 'Save 5 deals from the same brand',
    icon: '\uD83D\uDC9C',
    badge: '\uD83D\uDC9C Loyalist',
    requirement: { action: 'save', sameBrand: 5 },
  },
];

export function getChallengeById(id: string): ChallengeDefinition | undefined {
  return CHALLENGES.find((c) => c.id === id);
}
