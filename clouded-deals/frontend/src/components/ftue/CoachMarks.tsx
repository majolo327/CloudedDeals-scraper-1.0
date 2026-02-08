'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

const COACH_KEY = 'clouded_coach_marks_seen';

export function isCoachMarksSeen(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(COACH_KEY) === 'true';
}

export function markCoachMarksSeen(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(COACH_KEY, 'true');
}

interface Step {
  /** CSS selector for the element to spotlight */
  selector: string;
  /** Tooltip text */
  title: string;
  /** CTA label */
  cta: string;
}

const STEPS: Step[] = [
  {
    selector: '[data-coach="deal-card"]',
    title: 'Tap any deal to go straight to the product page and get it',
    cta: 'Next',
  },
  {
    selector: '[data-coach="save-button"]',
    title: "Save deals to build your list \u2014 they expire at midnight, so don't wait",
    cta: 'Next',
  },
  {
    selector: '[data-coach="filter-bar"]',
    title: 'Filter by category, brand, and price to find exactly what you want',
    cta: 'Got It',
  },
];

interface CoachMarksProps {
  onComplete: () => void;
}

export function CoachMarks({ onComplete }: CoachMarksProps) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const observerRef = useRef<MutationObserver | null>(null);

  const findTarget = useCallback(() => {
    const current = STEPS[step];
    if (!current) return;
    const el = document.querySelector(current.selector);
    if (el) {
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null);
    }
  }, [step]);

  // Mount portal only on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Watch for DOM changes + scroll to find target
  useEffect(() => {
    findTarget();

    // Re-measure on scroll/resize
    const handleUpdate = () => findTarget();
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    // Observe DOM changes in case elements render late
    observerRef.current = new MutationObserver(handleUpdate);
    observerRef.current.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
      observerRef.current?.disconnect();
    };
  }, [findTarget]);

  const dismiss = useCallback(() => {
    markCoachMarksSeen();
    trackEvent('onboarding_screen_viewed', undefined, {
      screen: 'coach_marks',
      result: 'dismissed',
      step: String(step),
    });
    onComplete();
  }, [step, onComplete]);

  const handleNext = useCallback(() => {
    if (step >= STEPS.length - 1) {
      markCoachMarksSeen();
      trackEvent('onboarding_completed', undefined, {
        screen: 'coach_marks',
        result: 'completed',
      });
      onComplete();
    } else {
      setStep((s) => s + 1);
    }
  }, [step, onComplete]);

  if (!mounted) return null;

  const current = STEPS[step];
  const padding = 8;

  // Calculate tooltip position
  let tooltipTop = 0;
  let tooltipAlign: 'above' | 'below' = 'below';
  if (rect) {
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow > 160) {
      tooltipAlign = 'below';
      tooltipTop = rect.bottom + padding + 8;
    } else {
      tooltipAlign = 'above';
      tooltipTop = rect.top - padding - 8;
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[110] transition-opacity duration-300"
      onClick={dismiss}
    >
      {/* Dark overlay with cutout */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <defs>
          <mask id="coach-mask">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - padding}
                y={rect.top - padding}
                width={rect.width + padding * 2}
                height={rect.height + padding * 2}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.75)"
          mask="url(#coach-mask)"
        />
      </svg>

      {/* Spotlight border glow */}
      {rect && (
        <div
          className="absolute rounded-xl border-2 border-purple-500/60 shadow-lg shadow-purple-500/20 pointer-events-none transition-all duration-300"
          style={{
            left: rect.left - padding,
            top: rect.top - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2,
          }}
        />
      )}

      {/* Tooltip */}
      {rect && (
        <div
          className="absolute left-4 right-4 max-w-sm mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{
            top: tooltipAlign === 'below' ? tooltipTop : undefined,
            bottom: tooltipAlign === 'above' ? window.innerHeight - tooltipTop : undefined,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-xl">
            <p className="text-sm text-white leading-relaxed mb-4">
              {current.title}
            </p>
            <div className="flex items-center justify-between">
              {/* Step dots */}
              <div className="flex gap-1.5">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      i === step ? 'bg-purple-400 w-4' : 'bg-slate-600'
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={handleNext}
                className="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 text-white text-sm font-medium transition-colors"
              >
                {current.cta}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dismiss X */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          dismiss();
        }}
        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Fallback — if target element not found, show floating tip */}
      {!rect && (
        <div className="absolute inset-x-4 bottom-24 max-w-sm mx-auto" onClick={(e) => e.stopPropagation()}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-xl">
            <p className="text-sm text-white leading-relaxed mb-4">
              {current.title}
            </p>
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      i === step ? 'bg-purple-400 w-4' : 'bg-slate-600'
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={handleNext}
                className="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 text-white text-sm font-medium transition-colors"
              >
                {current.cta}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
