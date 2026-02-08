import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Clouded Deals — Every Deal. Every Dispensary. One Place.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, #1a0a2e 0%, #0a0a0a 50%, #0a0a0a 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            marginBottom: 24,
          }}
        >
          <span
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: '#f5f5f5',
              letterSpacing: '-0.02em',
            }}
          >
            Clouded
          </span>
          <span
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: '#a78bfa',
              letterSpacing: '-0.02em',
            }}
          >
            Deals
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 32,
            fontWeight: 600,
            color: '#e2e8f0',
            marginBottom: 16,
            display: 'flex',
            gap: 8,
          }}
        >
          <span>Every Deal.</span>
          <span>Every Dispensary.</span>
          <span
            style={{
              background: 'linear-gradient(90deg, #34d399, #a78bfa)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            One Place.
          </span>
        </div>

        {/* Subtext */}
        <div
          style={{
            fontSize: 20,
            color: '#94a3b8',
            maxWidth: 700,
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          Las Vegas cannabis deals, updated daily. Flower, vapes, edibles, concentrates — the best prices from every dispensary.
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: 'linear-gradient(90deg, #7c3aed, #a78bfa, #34d399)',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
