import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/admin/verify-pin
 *
 * Verifies the admin PIN against the ADMIN_PIN environment variable.
 * Returns 200 if valid, 401 if invalid.
 *
 * Includes server-side rate limiting: 5 failed attempts per IP
 * within a 15-minute window triggers a lockout.
 *
 * Set ADMIN_PIN in your environment:
 *   ADMIN_PIN=123456
 *
 * If ADMIN_PIN is not set, defaults to '000000' in development only.
 */

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;

// In-memory store for rate limiting (resets on deploy/restart, which is acceptable
// for a Netlify serverless function — persistent rate limiting would need Redis)
const failedAttempts = new Map<string, { count: number; firstAttempt: number }>();

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function isRateLimited(ip: string): boolean {
  const record = failedAttempts.get(ip);
  if (!record) return false;

  // Window expired — clear and allow
  if (Date.now() - record.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    failedAttempts.delete(ip);
    return false;
  }

  return record.count >= MAX_FAILED_ATTEMPTS;
}

function recordFailedAttempt(ip: string): void {
  const record = failedAttempts.get(ip);
  const now = Date.now();

  if (!record || now - record.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    failedAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    record.count++;
  }
}

function clearFailedAttempts(ip: string): void {
  failedAttempts.delete(ip);
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    // Check rate limit before processing
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many failed attempts. Try again in 15 minutes.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { pin } = body;

    if (!pin || typeof pin !== 'string' || pin.length !== 6) {
      return NextResponse.json({ error: 'Invalid PIN format' }, { status: 400 });
    }

    const adminPin = process.env.ADMIN_PIN || (process.env.NODE_ENV === 'development' ? '000000' : '');

    if (!adminPin) {
      // No PIN configured in production — deny all access
      return NextResponse.json({ error: 'Admin access not configured' }, { status: 403 });
    }

    // Constant-time comparison to prevent timing attacks
    if (pin.length !== adminPin.length) {
      recordFailedAttempt(ip);
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
    }

    let match = true;
    for (let i = 0; i < pin.length; i++) {
      if (pin[i] !== adminPin[i]) match = false;
    }

    if (!match) {
      recordFailedAttempt(ip);
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
    }

    // Successful auth — clear any failed attempts
    clearFailedAttempts(ip);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}
