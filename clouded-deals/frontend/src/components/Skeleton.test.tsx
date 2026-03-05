import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DealCardSkeleton, TopPickSkeleton } from './Skeleton';

describe('Skeleton — Tab loading skeletons (Phase 3 #6)', () => {
  it('DealCardSkeleton renders with role="status"', () => {
    render(<DealCardSkeleton />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('DealCardSkeleton has aria-label="Loading deal"', () => {
    render(<DealCardSkeleton />);
    expect(screen.getByLabelText('Loading deal')).toBeInTheDocument();
  });

  it('TopPickSkeleton renders with role="status"', () => {
    render(<TopPickSkeleton />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('TopPickSkeleton has aria-label="Loading top pick"', () => {
    render(<TopPickSkeleton />);
    expect(screen.getByLabelText('Loading top pick')).toBeInTheDocument();
  });
});
