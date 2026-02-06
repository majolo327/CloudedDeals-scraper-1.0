'use client';

import { useState } from 'react';
import { X, Heart, Mail, Loader2 } from 'lucide-react';
import { sendMagicLink } from '@/lib/auth';
import { trackEvent } from '@/lib/analytics';

interface AuthPromptProps {
  onClose: () => void;
  savedCount: number;
}

export function AuthPrompt({ onClose, savedCount }: AuthPromptProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || status === 'sending') return;

    setStatus('sending');
    setErrorMsg('');
    trackEvent('auth_prompt_submitted' as never, undefined, { email_provided: true });

    const { error } = await sendMagicLink(email.trim());
    if (error) {
      setStatus('error');
      setErrorMsg(error);
    } else {
      setStatus('sent');
    }
  };

  const handleSkip = () => {
    trackEvent('auth_prompt_submitted' as never, undefined, { skipped: true });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4"
      onClick={handleSkip}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-soft-reveal" />
      <div
        className="relative w-full sm:max-w-md glass-strong frost rounded-t-2xl sm:rounded-2xl animate-soft-reveal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-2">
          <div className="w-10 h-1 bg-slate-600 rounded-full" />
        </div>

        <div className="p-6">
          {/* Close button */}
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 w-8 h-8 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          {status === 'sent' ? (
            /* Success state */
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-purple-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Check your email!</h2>
              <p className="text-sm text-slate-400 mb-6">
                We sent a magic link to <span className="text-slate-200">{email}</span>.
                Click the link to log in and sync your saves.
              </p>
              <button
                onClick={onClose}
                className="w-full py-3 min-h-[48px] rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 font-medium transition-colors text-sm"
              >
                Got it
              </button>
            </div>
          ) : (
            /* Form state */
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                  <Heart className="w-6 h-6 text-purple-400 fill-current" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Nice! You&apos;ve saved {savedCount} deals
                  </h2>
                  <p className="text-sm text-slate-400">
                    Drop your email to never lose them
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  autoFocus
                  className="w-full px-4 py-3 min-h-[48px] rounded-xl bg-white/5 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
                />

                {errorMsg && (
                  <p className="text-xs text-red-400">{errorMsg}</p>
                )}

                <button
                  type="submit"
                  disabled={!email.trim() || status === 'sending'}
                  className="w-full py-3 min-h-[48px] bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 text-sm"
                >
                  {status === 'sending' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Magic Link'
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSkip}
                  className="w-full py-2.5 min-h-[44px] text-slate-500 hover:text-slate-300 text-sm transition-colors"
                >
                  Maybe later
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
