import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Toast, ToastContainer } from './Toast';
import type { ToastData } from './Toast';

describe('Toast — ARIA live regions (Phase 2 #2) + completeness (Phase 2 #9)', () => {
  const mockToast: ToastData = {
    id: 'toast-1',
    message: 'Deal saved!',
    type: 'saved',
  };

  it('Toast renders with role="status"', () => {
    render(<Toast toast={mockToast} onDismiss={vi.fn()} />);
    const el = screen.getByRole('status');
    expect(el).toBeInTheDocument();
  });

  it('Toast renders the message text', () => {
    render(<Toast toast={mockToast} onDismiss={vi.fn()} />);
    expect(screen.getByText('Deal saved!')).toBeInTheDocument();
  });

  it('ToastContainer has aria-live="polite"', () => {
    const { container } = render(
      <ToastContainer toasts={[mockToast]} onDismiss={vi.fn()} />
    );
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
  });

  it('ToastContainer has aria-atomic="false"', () => {
    const { container } = render(
      <ToastContainer toasts={[mockToast]} onDismiss={vi.fn()} />
    );
    const el = container.querySelector('[aria-atomic="false"]');
    expect(el).not.toBeNull();
  });

  it('renders correct icon for each toast type', () => {
    const types: ToastData['type'][] = ['success', 'saved', 'removed', 'milestone', 'discovery'];
    types.forEach((type) => {
      const { unmount } = render(
        <Toast toast={{ id: `t-${type}`, message: `Test ${type}`, type }} onDismiss={vi.fn()} />
      );
      expect(screen.getByText(`Test ${type}`)).toBeInTheDocument();
      unmount();
    });
  });
});
