'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

/**
 * Lightweight feedback widget — small floating icon that expands into
 * a single-field form.  Stores feedback in analytics_events as
 * 'user_feedback'.  Non-intrusive, dismissible, no account needed.
 */
export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open]);

  const handleSubmit = () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    trackEvent('user_feedback', undefined, {
      message: trimmed,
      page: window.location.pathname,
      source: 'widget',
    });

    setMessage('');
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setOpen(false);
    }, 2000);
  };

  return (
    <div className="fixed bottom-20 right-4 z-40 sm:bottom-6">
      {/* Expanded form */}
      {open && (
        <div className="mb-2 w-72 rounded-xl border border-slate-700 bg-slate-900/95 p-3 shadow-xl backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-300">
              Send us feedback
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {sent ? (
            <p className="text-sm text-green-400 py-2">Thanks! We read every message.</p>
          ) : (
            <>
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What's missing? What could be better?"
                rows={3}
                maxLength={500}
                className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-slate-600">
                  {message.length}/500
                </span>
                <button
                  onClick={handleSubmit}
                  disabled={!message.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-purple-500/20 px-3 py-1.5 text-xs font-medium text-purple-400 transition-colors hover:bg-purple-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="w-3 h-3" />
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating trigger */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Have feedback? Let us know"
          className="group flex h-10 w-10 items-center justify-center rounded-full border border-slate-700/60 bg-slate-900/90 shadow-lg backdrop-blur-sm transition-all hover:border-purple-500/40 hover:bg-slate-800/90 hover:scale-105"
        >
          <MessageCircle className="w-4.5 h-4.5 text-slate-400 group-hover:text-purple-400 transition-colors" />
        </button>
      )}
    </div>
  );
}

/**
 * Inline feedback prompt — used inside empty states (search no results,
 * filter no matches).  More contextual than the floating widget.
 */
export function InlineFeedbackPrompt({
  context,
  query,
}: {
  context: string;
  query?: string;
}) {
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    trackEvent('user_feedback', undefined, {
      message: trimmed,
      page: window.location.pathname,
      source: 'inline',
      context,
      ...(query ? { search_query: query } : {}),
    });

    setMessage('');
    setSent(true);
  };

  if (sent) {
    return (
      <p className="text-xs text-green-400/80 mt-3">
        Thanks for the feedback!
      </p>
    );
  }

  return (
    <div className="mt-6 max-w-xs mx-auto">
      <p className="text-slate-500 text-xs mb-2">
        Can&apos;t find what you want? Let us know.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. looking for Cookies flower..."
          maxLength={200}
          className="flex-1 min-w-0 rounded-lg border border-slate-700/60 bg-slate-800/50 px-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:border-purple-500/40 focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!message.trim()}
          className="rounded-lg bg-purple-500/20 px-3 py-1.5 text-xs font-medium text-purple-400 hover:bg-purple-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
