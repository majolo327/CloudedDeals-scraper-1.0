/**
 * Haptic feedback vocabulary — consistent vibration language across the app.
 * Degrades gracefully on iOS Safari (no-op) and unsupported browsers.
 */

function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(pattern); } catch { /* unsupported */ }
  }
}

/** Light tap — button press, filter toggle, checkbox select */
export function hapticLight(): void {
  vibrate(10);
}

/** Medium pulse — deal saved, deal dismissed, filter applied */
export function hapticMedium(): void {
  vibrate(30);
}

/** Special double-tap — STEAL deal revealed, milestone reached */
export function hapticSpecial(): void {
  vibrate([15, 50, 15]);
}
