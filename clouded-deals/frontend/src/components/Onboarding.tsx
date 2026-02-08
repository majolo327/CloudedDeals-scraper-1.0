'use client';

import { useState, useCallback } from 'react';
import { ArrowRight, ShieldCheck, Heart, Zap, Bookmark } from 'lucide-react';
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
  cta: string;
}

const SCREENS: Screen[] = [
  {
    icon: <Zap className="w-12 h-12" />,
    title: 'Vegas deals, updated daily.',
    subtitle: 'We scan 27+ dispensaries every morning so you never overpay.',
    gradient: 'from-purple-500/20 to-indigo-500/20',
    cta: 'Next',
  },
  {
    icon: (
      <div className="relative">
        <Heart className="w-12 h-12" />
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
          <Bookmark className="w-3 h-3 text-white" />
        </div>
      </div>
    ),
    title: 'Tap the heart to save deals.',
    subtitle: 'When you see a deal you like, hit the \u2665 to save it. We\u2019ll track your saves so you can grab them at the shop.',
    gradient: 'from-pink-500/20 to-purple-500/20',
    cta: 'Got it',
  },
  {
    icon: <ShieldCheck className="w-12 h-12" />,
    title: 'Verified. No gimmicks.',
    subtitle: 'Real prices pulled from real menus. We verify every deal so you don\u2019t have to.',
    gradient: 'from-emerald-500/20 to-teal-500/20',
    cta: 'Start Saving Deals',
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
      trackEvent('onboarding_completed', undefined, {
        screen: String(currentScreen),
        email_captured: emailSent ? 'yes' : 'no',
      });
      onComplete();
    } else {
      trackEvent('onboarding_screen_viewed', undefined, { screen: String(currentScreen + 1) });
      setCurrentScreen((prev) => prev + 1);
    }
  }, [currentScreen, isLastScreen, onComplete, emailSent]);

  const handleSkip = useCallback(() => {
    markOnboardingSeen();
    trackEvent('onboarding_skipped', undefined, { screen: String(currentScreen) });
    onComplete();
  }, [currentScreen, onComplete]);

  const handleEmailSubmit = useCallback(async () => {
    if (!email.trim() || sending) return;
    setSending(true);
    const { error } = await sendMagicLink(email.trim());
    setSending(false);
    if (!error) {
      setEmailSent(true);
      trackEvent('onboarding_email_captured');
    }
  }, [email, sending]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (diff > 60) {
      handleNext();
    } else if (diff < -60 && currentScreen > 0) {
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

        {/* Interactive save demo on screen 2 */}
        {currentScreen === 1 && (
          <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
            <div className="glass frost rounded-xl px-6 py-4 flex items-center gap-4 max-w-xs mx-auto">
              <div className="text-left min-w-0">
                <p className="text-[10px] text-purple-400 uppercase font-bold">Example Brand</p>
                <p className="text-xs text-white font-medium truncate">Top Shelf Flower 3.5g</p>
                <p className="text-sm font-mono font-bold text-white mt-1">
                  $25 <span className="text-[10px] text-slate-500 line-through">$45</span>
                  <span className="text-[10px] text-emerald-400 ml-1">-44%</span>
                </p>
              </div>
              <div className="shrink-0">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center animate-pulse">
                  <Heart className="w-5 h-5 text-purple-400" />
                </div>
                <p className="text-[8px] text-purple-400 mt-1 text-center font-medium">Tap to save</p>
              </div>
            </div>
          </div>
        )}

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
          {screen.cta}
          {!isLastScreen && <ArrowRight className="w-5 h-5" />}
          {isLastScreen && <Heart className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
