import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/admin/verify-pin
 *
 * Verifies the admin PIN against the ADMIN_PIN environment variable.
 * Returns 200 if valid, 401 if invalid.
 *
 * Set ADMIN_PIN in your environment:
 *   ADMIN_PIN=123456
 *
 * If ADMIN_PIN is not set, defaults to '000000' in development only.
 */
export async function POST(request: NextRequest) {
  try {
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
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
    }

    let match = true;
    for (let i = 0; i < pin.length; i++) {
      if (pin[i] !== adminPin[i]) match = false;
    }

    if (!match) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}
