'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

const PIN_LENGTH = 6;
const ADMIN_PIN_KEY = 'clouded_admin_pin';
const MAX_ATTEMPTS = 5;
const LOCKOUT_KEY = 'clouded_admin_lockout';
const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Check if the admin PIN has been verified this session.
 */
export function isAdminVerified(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(ADMIN_PIN_KEY) === 'verified';
}

/**
 * Clear admin verification (sign out).
 */
export function clearAdminVerification(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(ADMIN_PIN_KEY);
}

interface AdminPinGateProps {
  onVerified: () => void;
}

export function AdminPinGate({ onVerified }: AdminPinGateProps) {
  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Check lockout on mount
  useEffect(() => {
    const lockoutTime = localStorage.getItem(LOCKOUT_KEY);
    if (lockoutTime) {
      const until = parseInt(lockoutTime, 10);
      if (Date.now() < until) {
        setLockedUntil(until);
      } else {
        localStorage.removeItem(LOCKOUT_KEY);
      }
    }
  }, []);

  // Countdown timer for lockout
  useEffect(() => {
    if (!lockedUntil) return;
    const interval = setInterval(() => {
      if (Date.now() >= lockedUntil) {
        setLockedUntil(null);
        localStorage.removeItem(LOCKOUT_KEY);
        setAttempts(0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const handleDigitChange = useCallback((index: number, value: string) => {
    if (lockedUntil) return;

    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setError('');

    // Auto-advance to next input
    if (digit && index < PIN_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (digit && newDigits.every((d) => d !== '')) {
      verifyPin(newDigits.join(''));
    }
  }, [digits, lockedUntil, verifyPin]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [digits]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH);
    if (pasted.length === PIN_LENGTH) {
      const newDigits = pasted.split('');
      setDigits(newDigits);
      verifyPin(pasted);
    }
  }, [verifyPin]); // eslint-disable-line react-hooks/exhaustive-deps

  const verifyPin = async (pin: string) => {
    setVerifying(true);
    setError('');

    try {
      const res = await fetch('/api/admin/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      if (res.ok) {
        sessionStorage.setItem(ADMIN_PIN_KEY, 'verified');
        onVerified();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        if (newAttempts >= MAX_ATTEMPTS) {
          const lockout = Date.now() + LOCKOUT_DURATION;
          setLockedUntil(lockout);
          localStorage.setItem(LOCKOUT_KEY, lockout.toString());
          setError('Too many attempts. Locked for 5 minutes.');
        } else {
          setError(`Invalid PIN. ${MAX_ATTEMPTS - newAttempts} attempts remaining.`);
        }

        setDigits(Array(PIN_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError('Network error. Please try again.');
      setDigits(Array(PIN_LENGTH).fill(''));
    } finally {
      setVerifying(false);
    }
  };

  const remainingLockout = lockedUntil ? Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000)) : 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <h1 className="text-lg font-bold text-green-600 dark:text-green-400 mb-1">
            CloudedDeals
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Admin Access</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 text-center mb-1">
            Enter Admin PIN
          </h2>
          <p className="text-xs text-zinc-400 text-center mb-6">
            6-digit PIN required for admin access
          </p>

          {/* PIN Input */}
          <div className="flex justify-center gap-2 mb-4" onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                disabled={verifying || !!lockedUntil}
                autoFocus={i === 0}
                className={`w-11 h-14 text-center text-xl font-bold rounded-xl border-2 transition-all focus:outline-none
                  ${error
                    ? 'border-red-400 dark:border-red-600'
                    : digit
                      ? 'border-green-400 dark:border-green-600 bg-green-50/50 dark:bg-green-900/20'
                      : 'border-zinc-200 dark:border-zinc-700 focus:border-green-500'
                  }
                  ${verifying || lockedUntil ? 'opacity-50 cursor-not-allowed' : ''}
                  text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800
                `}
              />
            ))}
          </div>

          {/* Error / Lockout */}
          {error && (
            <p className="text-xs text-red-500 text-center mb-3">{error}</p>
          )}
          {lockedUntil && remainingLockout > 0 && (
            <p className="text-xs text-amber-500 text-center mb-3">
              Try again in {Math.floor(remainingLockout / 60)}:{(remainingLockout % 60).toString().padStart(2, '0')}
            </p>
          )}

          {verifying && (
            <div className="flex justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
            </div>
          )}
        </div>

        <p className="text-[10px] text-zinc-400 text-center mt-4">
          Contact the admin for access credentials
        </p>
      </div>
    </div>
  );
}
