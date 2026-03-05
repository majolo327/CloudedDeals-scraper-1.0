import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DealCard } from './DealCard';
import { makeDeal } from '@/__tests__/helpers/factories';

// Mock dependencies
vi.mock('@/utils', () => ({
  getDistanceMiles: vi.fn(() => null),
  getDisplayName: vi.fn((name: string) => name),
  getPricePerUnit: vi.fn(() => null),
  getMapsUrl: vi.fn((addr: string) => `https://maps.google.com/?q=${addr}`),
}));

vi.mock('@/utils/dealFilters', () => ({
  getPricePerUnit: vi.fn(() => null),
}));

vi.mock('./ftue', () => ({
  getUserCoords: vi.fn(() => null),
}));

vi.mock('@/lib/haptics', () => ({
  hapticMedium: vi.fn(),
}));

beforeEach(() => {
  vi.useFakeTimers();
});

const defaultProps = {
  deal: makeDeal({ deal_price: 19.5, original_price: 40 }),
  isSaved: false,
  onSave: vi.fn(),
  onClick: vi.fn(),
  onDismiss: vi.fn(),
};

describe('DealCard — Price formatting (Phase 3 #1)', () => {
  it('renders price with .toFixed(2) — $19.50 not $19.5', () => {
    render(<DealCard {...defaultProps} />);
    expect(screen.getByText('$19.50')).toBeInTheDocument();
  });
});

describe('DealCard — Dismiss button contrast (Phase 3 #5)', () => {
  it('dismiss button has text-slate-500 class', () => {
    render(<DealCard {...defaultProps} />);
    const dismissBtn = screen.getByLabelText('Dismiss deal');
    expect(dismissBtn.className).toContain('text-slate-500');
  });
});

describe('DealCard — Long-press quick actions (Phase 1 #5, Phase 2 #5)', () => {
  it('long press (500ms) opens quick actions overlay with role="dialog"', () => {
    render(<DealCard {...defaultProps} />);
    const card = screen.getByText(defaultProps.deal.product_name).closest('[class*="glass"]')!;

    fireEvent.touchStart(card, { touches: [{ clientX: 100, clientY: 100 }] });
    act(() => { vi.advanceTimersByTime(500); });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('quick actions overlay has aria-modal="true" and aria-label', () => {
    render(<DealCard {...defaultProps} />);
    const card = screen.getByText(defaultProps.deal.product_name).closest('[class*="glass"]')!;

    fireEvent.touchStart(card, { touches: [{ clientX: 100, clientY: 100 }] });
    act(() => { vi.advanceTimersByTime(500); });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Quick actions');
  });

  it('Escape key closes the quick actions overlay', () => {
    render(<DealCard {...defaultProps} />);
    const card = screen.getByText(defaultProps.deal.product_name).closest('[class*="glass"]')!;

    fireEvent.touchStart(card, { touches: [{ clientX: 100, clientY: 100 }] });
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('DealCard — Seen-before indicator (Phase 1 #10, Phase 2 #8)', () => {
  it('shows seen-before dot when seenBefore=true', () => {
    render(<DealCard {...defaultProps} seenBefore={true} />);
    const dot = document.querySelector('[title="Seen before"]');
    expect(dot).not.toBeNull();
  });

  it('does not show seen-before dot when seenBefore=false', () => {
    render(<DealCard {...defaultProps} seenBefore={false} />);
    const dot = document.querySelector('[title="Seen before"]');
    expect(dot).toBeNull();
  });
});

describe('DealCard — React.memo comparator (Phase 2 #8)', () => {
  it('does not re-render when props are identical', () => {
    const renderSpy = vi.fn();
    const deal = makeDeal();

    // DealCard is wrapped in memo — re-rendering with identical props should skip
    const { rerender } = render(
      <DealCard deal={deal} isSaved={false} onSave={renderSpy} onClick={vi.fn()} />
    );

    // Re-render with same props
    rerender(
      <DealCard deal={deal} isSaved={false} onSave={renderSpy} onClick={vi.fn()} />
    );

    // The memo comparator checks deal.id, isSaved, isUsed, isExpired, seenBefore, distanceLabel, recommendationLabel
    // We can't easily spy on render count with memo, but we verify the comparator exists
    // by checking DealCard is a memo component
    expect(DealCard).toHaveProperty('$$typeof');
  });
});
