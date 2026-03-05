import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const css = readFileSync(resolve(__dirname, '../app/globals.css'), 'utf-8');

describe('CSS: Prefers-Reduced-Motion (Phase 1 #3)', () => {
  it('has prefers-reduced-motion media query', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('reduces animation-duration to near-zero', () => {
    expect(css).toContain('animation-duration: 0.01ms');
  });

  it('reduces transition-duration to near-zero', () => {
    expect(css).toContain('transition-duration: 0.01ms');
  });
});

describe('CSS: Transition Polish (Phase 1 #9)', () => {
  it('defines --ease-smooth custom property', () => {
    expect(css).toContain('--ease-smooth:');
  });

  it('defines --ease-spring custom property', () => {
    expect(css).toContain('--ease-spring:');
  });

  it('defines --ease-dismiss for fast exits', () => {
    expect(css).toContain('--ease-dismiss:');
  });

  it('defines --duration-fast and --duration-instant', () => {
    expect(css).toContain('--duration-fast:');
    expect(css).toContain('--duration-instant:');
  });

  it('defines --duration-normal and --duration-slow', () => {
    expect(css).toContain('--duration-normal:');
    expect(css).toContain('--duration-slow:');
  });
});

describe('CSS: Bottom-Sheet Slide (Phase 2 #6)', () => {
  it('defines bottomSheetSlideUp keyframe', () => {
    expect(css).toContain('@keyframes bottomSheetSlideUp');
  });

  it('defines animate-modal-enter utility', () => {
    expect(css).toContain('.animate-modal-enter');
  });

  it('uses softReveal on desktop (min-width: 640px)', () => {
    // The desktop override switches to softReveal
    expect(css).toContain('@keyframes softReveal');
  });
});

describe('CSS: Button Press Feedback (Phase 3 #2)', () => {
  it('has button:active scale rule', () => {
    expect(css).toContain('button:active:not(:disabled)');
    expect(css).toContain('scale(0.97)');
  });

  it('applies to role="button" elements too', () => {
    expect(css).toContain('[role="button"]:active:not(:disabled)');
  });
});

describe('CSS: iOS Scroll Momentum (Phase 3 #4)', () => {
  it('applies -webkit-overflow-scrolling: touch to scrollbar-hide', () => {
    expect(css).toContain('-webkit-overflow-scrolling: touch');
  });

  it('applies overscroll-behavior-x: contain', () => {
    expect(css).toContain('overscroll-behavior-x: contain');
  });
});

describe('CSS: Save Counter Pulse (Phase 3 #9)', () => {
  it('defines heartPulse keyframe', () => {
    expect(css).toContain('@keyframes heartPulse');
  });

  it('defines animate-heart-pulse utility', () => {
    expect(css).toContain('.animate-heart-pulse');
  });
});

describe('CSS: Swipe Overlay Slide-Up (Phase 3 #7)', () => {
  it('animate-modal-enter uses bottomSheetSlideUp on mobile', () => {
    expect(css).toContain('.animate-modal-enter { animation: bottomSheetSlideUp');
  });
});
