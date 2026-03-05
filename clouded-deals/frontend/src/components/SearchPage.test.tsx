import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { SearchPage } from './SearchPage';

// Mock heavy dependencies
vi.mock('@/lib/api', () => ({
  searchExtendedDeals: vi.fn(async () => []),
}));

vi.mock('@/hooks/useSavedDeals', () => ({
  useSavedDeals: vi.fn(() => ({
    savedIds: new Set<string>(),
    toggleSave: vi.fn(),
    usedIds: new Set<string>(),
    toggleUsed: vi.fn(),
    savedCount: 0,
  })),
}));

vi.mock('./modals', () => ({
  DealModal: () => null,
}));

const defaultProps = {
  deals: [],
  brands: [],
  savedDeals: new Set<string>(),
  toggleSavedDeal: vi.fn(),
  setSelectedDeal: vi.fn(),
};

describe('SearchPage — Search input optimization (Phase 3 #3)', () => {
  it('search input has autoCorrect="off"', () => {
    const { container } = render(<SearchPage {...defaultProps} />);
    const input = container.querySelector('input[type="text"]');
    expect(input).toHaveAttribute('autoCorrect', 'off');
  });

  it('search input has autoCapitalize="off"', () => {
    const { container } = render(<SearchPage {...defaultProps} />);
    const input = container.querySelector('input[type="text"]');
    expect(input).toHaveAttribute('autoCapitalize', 'off');
  });

  it('search input has spellCheck={false}', () => {
    const { container } = render(<SearchPage {...defaultProps} />);
    const input = container.querySelector('input[type="text"]');
    expect(input).toHaveAttribute('spellcheck', 'false');
  });

  it('search input has autoComplete="off"', () => {
    const { container } = render(<SearchPage {...defaultProps} />);
    const input = container.querySelector('input[type="text"]');
    expect(input).toHaveAttribute('autoComplete', 'off');
  });
});
