import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock navigator.vibrate (for haptics tests)
Object.defineProperty(navigator, 'vibrate', {
  value: vi.fn(() => true),
  writable: true,
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock @/lib/analytics globally
vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
  getOrCreateAnonId: vi.fn(() => 'test-anon-id'),
  trackGetDealClick: vi.fn(),
}));

// Mock @/lib/supabase globally
vi.mock('@/lib/supabase', () => ({
  getSupabase: vi.fn(() => null),
  createServiceClient: vi.fn(() => null),
  isSupabaseConfigured: vi.fn(() => false),
}));
