'use client';

import { useState, useEffect } from 'react';
import { Mail, Zap, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getOrCreateAnonId, trackEvent } from '@/lib/analytics';

const STORAGE_KEY = 'clouded_beta_email_captured';
const DISMISS_KEY = 'clouded_beta_email_dismissed';

interface BetaEmailCaptureProps {
  addToast: (message: string, type: 'success' | 'info') => void;
}

/**
 * Non-intrusive inline email capture that appears in the deal feed.
 *
 * Psychology hooks used:
 *  - Foot-in-the-door: user has already scrolled + viewed deals → low-friction ask
 *  - Exclusivity / scarcity: "beta tester", "first to know"
 *  - Social proof: "Join our founding testers"
 *  - Loss aversion: "Don't miss tomorrow's deals"
 *  - Reciprocity: we gave you free deals, a simple email is fair exchange
 */
export function BetaEmailCapture({ addToast }: BetaEmailCaptureProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already captured or dismissed in this session
    const captured = localStorage.getItem(STORAGE_KEY) === 'true';
    const dismissed = sessionStorage.getItem(DISMISS_KEY) === 'true';
    if (!captured && !dismissed) {
      setVisible(true);
    }
  }, []);

  if (!visible || status === 'done') return null;

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || status === 'submitting') return;

    setStatus('submitting');
    try {
      const anonId = getOrCreateAnonId();
      const { error } = await supabase
        .from('user_contacts')
        .insert({
          anon_id: anonId || null,
          email: email.trim(),
          source: 'beta_inline_feed',
        });

      if (error && error.code !== '23505') {
        setStatus('idle');
        return;
      }

      localStorage.setItem(STORAGE_KEY, 'true');
      trackEvent('deal_viewed' as never, undefined, {
        action: 'beta_email_captured',
        source: 'inline_feed',
      });
      setStatus('done');
      addToast("You're in! We'll keep you posted.", 'success');
      setVisible(false);
    } catch {
      setStatus('idle');
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, 'true');
    setVisible(false);
  };

  return (
    <div className="relative mx-auto max-w-md px-4 py-2">
      <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/[0.06] to-transparent p-5 backdrop-blur-sm">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 rounded-full text-slate-500 hover:text-white hover:bg-white/10 transition-all"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">
            Beta Tester Perk
          </span>
        </div>

        <p className="text-sm text-white font-medium mb-1">
          Get tomorrow&apos;s best deals before they go live.
        </p>
        <p className="text-xs text-slate-400 mb-3">
          Join our founding testers. First to know about new features, deal drops, and launches.
        </p>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="flex-1 px-3 py-2.5 min-h-[44px] rounded-xl bg-white/5 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
          />
          <button
            type="submit"
            disabled={!isValid || status === 'submitting'}
            className="px-4 py-2.5 min-h-[44px] bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all text-sm shrink-0 flex items-center gap-1.5"
          >
            <Mail className="w-3.5 h-3.5" />
            I&apos;m in
          </button>
        </form>

        <p className="text-[10px] text-slate-600 mt-2">
          No spam, ever. Just deals and updates.
        </p>
      </div>
    </div>
  );
}
