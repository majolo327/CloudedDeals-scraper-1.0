import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import GlobalError from './error';

describe('Error Boundary — No Sentry import (Phase 2 #4)', () => {
  it('renders "Something went wrong" message', () => {
    const error = new Error('Test error');
    render(<GlobalError error={error} reset={vi.fn()} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders "Try Again" button', () => {
    const error = new Error('Test error');
    render(<GlobalError error={error} reset={vi.fn()} />);
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('renders "Back to Deals" link', () => {
    const error = new Error('Test error');
    render(<GlobalError error={error} reset={vi.fn()} />);
    const link = screen.getByText('Back to Deals');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/');
  });

  it('calls reset when "Try Again" is clicked', () => {
    const reset = vi.fn();
    const error = new Error('Test error');
    render(<GlobalError error={error} reset={reset} />);
    screen.getByText('Try Again').click();
    expect(reset).toHaveBeenCalledOnce();
  });

  it('does not import @sentry/nextjs (uses console.error instead)', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Test error');
    render(<GlobalError error={error} reset={vi.fn()} />);
    expect(consoleSpy).toHaveBeenCalledWith('[CloudedDeals] Unhandled error:', error);
    consoleSpy.mockRestore();
  });
});
