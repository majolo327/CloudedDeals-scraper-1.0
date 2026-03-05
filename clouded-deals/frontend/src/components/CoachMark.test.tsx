import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { CoachMark } from './CoachMark';

const COACH_MARKS_KEY = 'clouded_coach_marks_seen';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

describe('CoachMark — Gesture Discovery (Phase 1 #4) + aria-hidden (Phase 2 #1)', () => {
  it('renders hint after 500ms delay when mark is unseen', () => {
    render(<CoachMark id="swipe_hints"><span>Swipe to dismiss</span></CoachMark>);
    expect(screen.queryByText('Swipe to dismiss')).not.toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByText('Swipe to dismiss')).toBeInTheDocument();
  });

  it('does NOT render when mark is already in localStorage', () => {
    localStorage.setItem(COACH_MARKS_KEY, JSON.stringify(['swipe_hints']));
    render(<CoachMark id="swipe_hints"><span>Swipe to dismiss</span></CoachMark>);

    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.queryByText('Swipe to dismiss')).not.toBeInTheDocument();
  });

  it('has aria-hidden="true" on the wrapper', () => {
    render(<CoachMark id="swipe_hints"><span>Swipe to dismiss</span></CoachMark>);
    act(() => { vi.advanceTimersByTime(500); });

    const wrapper = screen.getByText('Swipe to dismiss').parentElement;
    expect(wrapper).toHaveAttribute('aria-hidden', 'true');
  });

  it('has role="presentation" on the wrapper', () => {
    render(<CoachMark id="swipe_hints"><span>Swipe to dismiss</span></CoachMark>);
    act(() => { vi.advanceTimersByTime(500); });

    const wrapper = screen.getByText('Swipe to dismiss').parentElement;
    expect(wrapper).toHaveAttribute('role', 'presentation');
  });

  it('persists mark to localStorage after duration expires', () => {
    render(<CoachMark id="modal_drag" duration={2000}><span>Drag</span></CoachMark>);
    act(() => { vi.advanceTimersByTime(2500); }); // 500ms delay + 2000ms duration

    const stored = JSON.parse(localStorage.getItem(COACH_MARKS_KEY) || '[]');
    expect(stored).toContain('modal_drag');
  });
});
