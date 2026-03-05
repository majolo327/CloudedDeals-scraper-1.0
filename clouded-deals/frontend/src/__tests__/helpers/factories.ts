import type { Deal, Dispensary, Brand } from '@/types';

let idCounter = 0;

export function makeDispensary(overrides: Partial<Dispensary> = {}): Dispensary {
  return {
    id: 'disp-1',
    name: 'Test Dispensary',
    slug: 'test-dispensary',
    tier: 'standard',
    address: '123 Strip Blvd, Las Vegas, NV',
    menu_url: 'https://example.com/menu',
    platform: 'dutchie',
    is_active: true,
    latitude: 36.1,
    longitude: -115.17,
    ...overrides,
  };
}

export function makeBrand(overrides: Partial<Brand> = {}): Brand {
  return {
    id: 'brand-1',
    name: 'Test Brand',
    slug: 'test-brand',
    tier: 'established',
    categories: ['flower'],
    ...overrides,
  };
}

export function makeDeal(overrides: Partial<Deal> = {}): Deal {
  idCounter++;
  return {
    id: `deal-${idCounter}`,
    product_name: `Test Product ${idCounter}`,
    category: 'flower',
    weight: '3.5g',
    original_price: 50,
    deal_price: 25,
    deal_score: 75,
    is_verified: true,
    created_at: new Date('2026-03-05'),
    dispensary: makeDispensary(),
    brand: makeBrand(),
    ...overrides,
  };
}
