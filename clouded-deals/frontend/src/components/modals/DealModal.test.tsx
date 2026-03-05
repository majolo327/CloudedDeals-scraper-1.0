import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DealModal } from './DealModal';
import { makeDeal } from '@/__tests__/helpers/factories';

// Mock sub-modals
vi.mock('./ShareModal', () => ({ ShareModal: () => null }));
vi.mock('./AccuracyModal', () => ({ AccuracyModal: () => null }));
vi.mock('./ReportDealModal', () => ({ ReportDealModal: () => null }));

vi.mock('@/utils', () => ({
  getMapsUrl: vi.fn((addr: string) => `https://maps.google.com/?q=${addr}`),
  getDisplayName: vi.fn((name: string) => name),
}));

const baseProps = {
  onClose: vi.fn(),
  isSaved: false,
  onToggleSave: vi.fn(),
};

describe('DealModal — Badge-matched CTA (Phase 2 #7)', () => {
  it('score >= 85 gets green (steal) CTA gradient', () => {
    const deal = makeDeal({ deal_score: 90, deal_price: 10, original_price: 50 });
    render(<DealModal deal={deal} {...baseProps} />);
    const cta = screen.getByText('Get This Deal').closest('a')!;
    expect(cta.className).toContain('from-emerald-500');
    expect(cta.className).toContain('to-green-600');
  });

  it('score 70-84 gets amber (fire) CTA gradient', () => {
    const deal = makeDeal({ deal_score: 75, deal_price: 20, original_price: 50 });
    render(<DealModal deal={deal} {...baseProps} />);
    const cta = screen.getByText('Get This Deal').closest('a')!;
    expect(cta.className).toContain('from-amber-500');
    expect(cta.className).toContain('to-orange-600');
  });

  it('score < 70 gets purple (solid) CTA gradient', () => {
    const deal = makeDeal({ deal_score: 60, deal_price: 25, original_price: 50 });
    render(<DealModal deal={deal} {...baseProps} />);
    const cta = screen.getByText('Get This Deal').closest('a')!;
    expect(cta.className).toContain('from-purple-500');
    expect(cta.className).toContain('to-purple-600');
  });
});

describe('DealModal — Sticky CTA (Phase 1 #7)', () => {
  it('CTA footer has gradient background for sticky effect', () => {
    const deal = makeDeal({ deal_price: 25, original_price: 50 });
    render(<DealModal deal={deal} {...baseProps} />);
    const cta = screen.getByText('Get This Deal').closest('a')!;
    const footer = cta.parentElement!;
    expect(footer.style.background).toContain('linear-gradient');
  });
});

describe('DealModal — Price formatting (Phase 3 #1)', () => {
  it('deal price renders with .toFixed(2)', () => {
    const deal = makeDeal({ deal_price: 19.5, original_price: 40 });
    render(<DealModal deal={deal} {...baseProps} />);
    expect(screen.getByText('$19.50')).toBeInTheDocument();
  });

  it('original price renders with .toFixed(2)', () => {
    const deal = makeDeal({ deal_price: 19.5, original_price: 40 });
    render(<DealModal deal={deal} {...baseProps} />);
    expect(screen.getByText('$40.00')).toBeInTheDocument();
  });

  it('savings renders with .toFixed(2)', () => {
    const deal = makeDeal({ deal_price: 19.5, original_price: 40 });
    render(<DealModal deal={deal} {...baseProps} />);
    expect(screen.getByText(/You save \$20\.50/)).toBeInTheDocument();
  });
});

describe('DealModal — Dialog accessibility', () => {
  it('has role="dialog" and aria-modal="true"', () => {
    const deal = makeDeal({ deal_price: 25, original_price: 50 });
    render(<DealModal deal={deal} {...baseProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
