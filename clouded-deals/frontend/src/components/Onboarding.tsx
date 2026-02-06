'use client';

import { useState, useCallback } from 'react';
import { ArrowRight, ShieldCheck, Heart, Zap } from 'lucide-react';
import { sendMagicLink } from '@/lib/auth';
import { trackEvent } from '@/lib/analytics';

const ONBOARDING_KEY = 'clouded_onboarding_seen';

export function isOnboardingSeen(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(ONBOARDING_KEY) === 'true';
}

export function markOnboardingSeen(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ONBOARDING_KEY, 'true');
}

interface OnboardingProps {
  onComplete: () => void;
}

interface Screen {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  gradient: string;
}

const SCREENS: Screen[] = [
  {
    icon: <Zap className="w-12 h-12" />,
    title: 'Vegas deals, updated daily.',
    subtitle: 'We scan 27+ dispensaries every morning so you never overpay.',
    gradient: 'from-purple-500/20 to-indigo-500/20',
  },
  {
    icon: <Heart className="w-12 h-12" />,
    title: 'Save the ones you like.',
    subtitle: 'Swipe through deals, save your favorites, and get directions to the shop.',
    gradient: 'from-pink-500/20 to-purple-500/20',
  },
  {
    icon: <ShieldCheck className="w-12 h-12" />,
    title: 'Verified. No gimmicks.',
    subtitle: 'Real prices from real menus. We verify deals so you don\'t have to.',
    gradient: 'from-emerald-500/20 to-teal-500/20',
  },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const isLastScreen = currentScreen === SCREENS.length - 1;

  const handleNext = useCallback(() => {
    if (isLastScreen) {
      markOnboardingSeen();
      trackEvent('app_loaded', undefined, { onboarding: 'completed', screen: currentScreen });
      onComplete();
    } else {
      setCurrentScreen((prev) => prev + 1);
    }
  }, [currentScreen, isLastScreen, onComplete]);

  const handleSkip = useCallback(() => {
    markOnboardingSeen();
    trackEvent('app_loaded', undefined, { onboarding: 'skipped', screen: currentScreen });
    onComplete();
  }, [currentScreen, onComplete]);

  const handleEmailSubmit = useCallback(async () => {
    if (!email.trim() || sending) return;
    setSending(true);
    const { error } = await sendMagicLink(email.trim());
    setSending(false);
    if (!error) {
      setEmailSent(true);
      trackEvent('app_loaded', undefined, { onboarding: 'email_captured' });
    }
  }, [email, sending]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (diff > 60) {
      // Swipe left → next
      handleNext();
    } else if (diff < -60 && currentScreen > 0) {
      // Swipe right → previous
      setCurrentScreen((prev) => prev - 1);
    }
    setTouchStart(null);
  };

  const screen = SCREENS[currentScreen];

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950 flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-b ${screen.gradient} to-transparent opacity-50 transition-all duration-500`} />

      {/* Skip button */}
      {!isLastScreen && (
        <div className="relative z-10 flex justify-end p-4">
          <button
            onClick={handleSkip}
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors py-2 px-3 min-h-[44px]"
          >
            Skip
          </button>
        </div>
      )}
      {isLastScreen && <div className="h-14" />}

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 text-center">
        {/* Icon */}
        <div className="mb-8 text-purple-400 animate-in fade-in zoom-in-95 duration-500" key={currentScreen}>
          {screen.icon}
        </div>

        {/* Title */}
        <h2
          className="text-2xl sm:text-3xl font-bold text-white mb-4 max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-500"
          key={`title-${currentScreen}`}
        >
          {screen.title}
        </h2>

        {/* Subtitle */}
        <p
          className="text-base text-slate-400 max-w-sm leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100"
          key={`sub-${currentScreen}`}
        >
          {screen.subtitle}
        </p>

        {/* Email capture on last screen */}
        {isLastScreen && (
          <div className="mt-8 w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
            {!emailSent ? (
              <div className="flex flex-col gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
                  placeholder="Email for deal alerts (optional)"
                  className="w-full px-4 py-3 min-h-[48px] rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
                />
                {email.trim() && (
                  <button
                    onClick={handleEmailSubmit}
                    disabled={sending}
                    className="w-full py-3 min-h-[48px] rounded-xl bg-purple-500/20 text-purple-400 text-sm font-medium hover:bg-purple-500/30 transition-colors disabled:opacity-50"
                  >
                    {sending ? 'Sending...' : 'Get deal alerts'}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-green-400">Check your email for a login link!</p>
            )}
          </div>
        )}
      </div>

      {/* Bottom: dots + button */}
      <div className="relative z-10 px-8 pb-12 sm:pb-16">
        {/* Dot indicators */}
        <div className="flex justify-center gap-2 mb-6">
          {SCREENS.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentScreen(i)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === currentScreen
                  ? 'bg-purple-400 w-6'
                  : 'bg-slate-700 hover:bg-slate-600'
              }`}
            />
          ))}
        </div>

        {/* CTA button */}
        <button
          onClick={handleNext}
          className="w-full py-4 min-h-[56px] bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-semibold text-base rounded-2xl shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2"
        >
          {isLastScreen ? 'Browse Deals' : 'Next'}
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
