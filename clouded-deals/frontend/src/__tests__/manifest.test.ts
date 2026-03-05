import { describe, it, expect } from 'vitest';
import manifest from '../../public/manifest.json';

describe('PWA Manifest (Phase 3 #10)', () => {
  it('has required PWA fields', () => {
    expect(manifest.name).toBe('CloudedDeals');
    expect(manifest.short_name).toBeDefined();
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons).toHaveLength(1);
    expect(manifest.icons[0].src).toBeTruthy();
  });

  it('has valid color values', () => {
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('is configured for portrait orientation', () => {
    expect(manifest.orientation).toBe('portrait-primary');
  });
});
