import { describe, it, expect } from 'vitest';
import { hapticLight, hapticMedium, hapticSpecial } from './haptics';

describe('Haptic Language (Phase 1 #2)', () => {
  it('hapticLight calls vibrate(10)', () => {
    hapticLight();
    expect(navigator.vibrate).toHaveBeenCalledWith(10);
  });

  it('hapticMedium calls vibrate(30)', () => {
    hapticMedium();
    expect(navigator.vibrate).toHaveBeenCalledWith(30);
  });

  it('hapticSpecial calls vibrate([15, 50, 15])', () => {
    hapticSpecial();
    expect(navigator.vibrate).toHaveBeenCalledWith([15, 50, 15]);
  });

  it('degrades gracefully when vibrate is undefined', () => {
    const original = navigator.vibrate;
    Object.defineProperty(navigator, 'vibrate', { value: undefined, writable: true });
    expect(() => hapticLight()).not.toThrow();
    expect(() => hapticMedium()).not.toThrow();
    expect(() => hapticSpecial()).not.toThrow();
    Object.defineProperty(navigator, 'vibrate', { value: original, writable: true });
  });
});
