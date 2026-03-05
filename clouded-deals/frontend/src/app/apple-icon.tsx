import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, #1a0a2e 0%, #0f0618 100%)',
          borderRadius: 36,
          position: 'relative',
        }}
      >
        {/* CD monogram */}
        <span
          style={{
            fontSize: 96,
            fontWeight: 800,
            color: '#f5f5f5',
            letterSpacing: '-4px',
            marginTop: -8,
          }}
        >
          CD
        </span>

        {/* Purple accent bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 22,
            left: 36,
            right: 36,
            height: 6,
            borderRadius: 3,
            background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
