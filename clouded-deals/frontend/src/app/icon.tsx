import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a0a2e',
          borderRadius: 6,
          position: 'relative',
        }}
      >
        {/* CD monogram */}
        <span
          style={{
            fontSize: 19,
            fontWeight: 800,
            color: '#f5f5f5',
            letterSpacing: '-1px',
            marginTop: -2,
          }}
        >
          CD
        </span>

        {/* Purple accent bar at bottom */}
        <div
          style={{
            position: 'absolute',
            bottom: 2,
            left: 6,
            right: 6,
            height: 2,
            borderRadius: 1,
            background: '#a78bfa',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
