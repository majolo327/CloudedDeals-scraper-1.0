/**
 * Geographic region detection for multi-market dispensary filtering.
 *
 * Regions:
 *   - 'southern-nv'  — Las Vegas, Henderson, North LV, Boulder City, etc.
 *   - 'northern-nv'  — Reno, Sparks, Carson City, etc.
 *
 * Detection priority:
 *   1. Explicit ZIP code input
 *   2. Browser geolocation (latitude threshold)
 *   3. Default: 'southern-nv'
 */

export type Region = 'southern-nv' | 'northern-nv';

const REGION_STORAGE_KEY = 'clouded_region';

export const DEFAULT_REGION: Region = 'southern-nv';

/**
 * Determine region from a Nevada ZIP code.
 *
 * Southern NV: 890xx–891xx, 893xx–894xx
 * Northern NV: 895xx–898xx
 *
 * Returns `null` for non-Nevada or unrecognised ZIP codes.
 */
export function regionFromZip(zip: string): Region | null {
  const trimmed = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(trimmed)) return null;

  const prefix = Number(trimmed.slice(0, 3));

  // Southern NV: 890–891, 893–894
  if (prefix >= 890 && prefix <= 891) return 'southern-nv';
  if (prefix >= 893 && prefix <= 894) return 'southern-nv';

  // Northern NV: 895–898
  if (prefix >= 895 && prefix <= 898) return 'northern-nv';

  return null;
}

/**
 * Determine region from latitude.
 * Roughly: > 37.5° N is northern NV (Reno area starts ~39.5° but we use a
 * generous threshold to capture Tonopah and surrounding areas).
 */
export function regionFromLatitude(lat: number): Region {
  return lat > 37.5 ? 'northern-nv' : 'southern-nv';
}

/**
 * Get the user's persisted region, or the default.
 */
export function getRegion(): Region {
  if (typeof window === 'undefined') return DEFAULT_REGION;
  try {
    const stored = localStorage.getItem(REGION_STORAGE_KEY);
    if (stored === 'southern-nv' || stored === 'northern-nv') return stored;
  } catch {
    // Storage unavailable
  }
  return DEFAULT_REGION;
}

/**
 * Persist the user's region selection.
 */
export function setRegion(region: Region): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REGION_STORAGE_KEY, region);
  } catch {
    // Storage full
  }
}

/**
 * Detect region using browser geolocation (async).
 * Falls back to the default region on error or denial.
 */
export function detectRegionFromGeolocation(): Promise<Region> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(DEFAULT_REGION);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(regionFromLatitude(pos.coords.latitude)),
      () => resolve(DEFAULT_REGION),
      { timeout: 5000, maximumAge: 600_000 },
    );
  });
}
