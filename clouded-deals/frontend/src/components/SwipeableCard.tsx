'use client';

import { useState } from 'react';
import { animated, useSpring } from 'react-spring';
import { useDrag } from '@use-gesture/react';
import { Heart, X, ExternalLink, MapPin, BadgeCheck } from 'lucide-react';
import type { Deal } from '@/types';

interface SwipeableCardProps {
  deal: Deal;
  isSaved: boolean;
  onSwipeRight: () => void;  // save
  onSwipeLeft: () => void;   // dismiss
  onSwipeUp: () => void;     // open external link
  onClick: () => void;       // open detail modal
  isTop: boolean;            // only top card is interactive
}

const SWIPE_THRESHOLD = 100;
const SWIPE_UP_THRESHOLD = 80;

export function SwipeableCard({
  deal,
  isSaved,
  onSwipeRight,
  onSwipeLeft,
  onSwipeUp,
  onClick,
  isTop,
}: SwipeableCardProps) {
  const [gone, setGone] = useState(false);

  const [{ x, y, rotate, scale }, api] = useSpring(() => ({
    x: 0,
    y: 0,
    rotate: 0,
    scale: 1,
    config: { friction: 50, tension: 500 },
  }));

  // Derived opacity for overlays based on drag direction
  const rightOpacity = x.to((val) => Math.min(Math.max(val / SWIPE_THRESHOLD, 0), 1));
  const leftOpacity = x.to((val) => Math.min(Math.max(-val / SWIPE_THRESHOLD, 0), 1));
  const upOpacity = y.to((val) => Math.min(Math.max(-val / SWIPE_UP_THRESHOLD, 0), 1));

  const bind = useDrag(
    ({ active, movement: [mx, my], direction: [dx, dy], velocity: [vx, vy] }) => {
      if (!isTop || gone) return;

      // Determine if swipe is complete
      const triggerRight = mx > SWIPE_THRESHOLD || (vx > 0.5 && dx > 0);
      const triggerLeft = mx < -SWIPE_THRESHOLD || (vx > 0.5 && dx < 0);
      const triggerUp = my < -SWIPE_UP_THRESHOLD || (vy > 0.5 && dy < 0);

      if (!active) {
        if (triggerUp && Math.abs(my) > Math.abs(mx)) {
          // Swipe up — open link
          setGone(true);
          api.start({
            y: -window.innerHeight,
            x: mx,
            rotate: 0,
            config: { friction: 50, tension: 200 },
            onRest: onSwipeUp,
          });
          tryHaptic();
          return;
        }
        if (triggerRight) {
          // Swipe right — save
          setGone(true);
          api.start({
            x: window.innerWidth + 200,
            rotate: 15,
            config: { friction: 50, tension: 200 },
            onRest: onSwipeRight,
          });
          tryHaptic();
          return;
        }
        if (triggerLeft) {
          // Swipe left — dismiss
          setGone(true);
          api.start({
            x: -window.innerWidth - 200,
            rotate: -15,
            config: { friction: 50, tension: 200 },
            onRest: onSwipeLeft,
          });
          tryHaptic();
          return;
        }
        // Spring back
        api.start({ x: 0, y: 0, rotate: 0, scale: 1 });
        return;
      }

      // While dragging
      api.start({
        x: mx,
        y: my,
        rotate: mx / 20,
        scale: 1.02,
        immediate: (key) => key === 'x' || key === 'y',
      });
    },
    {
      filterTaps: true,
      rubberband: true,
    }
  );

  const discount =
    deal.original_price && deal.original_price > deal.deal_price
      ? Math.round(((deal.original_price - deal.deal_price) / deal.original_price) * 100)
      : null;

  return (
    <animated.div
      {...(isTop ? bind() : {})}
      onClick={isTop && !gone ? onClick : undefined}
      style={{
        x,
        y,
        rotateZ: rotate,
        scale,
        touchAction: 'none',
      }}
      className={`absolute inset-0 ${isTop ? 'cursor-grab active:cursor-grabbing z-10' : 'z-0'}`}
    >
      <div className="relative w-full h-full bg-slate-800 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
        {/* Save overlay (right swipe) */}
        <animated.div
          style={{ opacity: rightOpacity }}
          className="absolute inset-0 bg-green-500/20 z-20 flex items-center justify-center pointer-events-none rounded-2xl"
        >
          <div className="w-20 h-20 rounded-full bg-green-500/30 flex items-center justify-center border-4 border-green-400">
            <Heart className="w-10 h-10 text-green-400 fill-current" />
          </div>
        </animated.div>

        {/* Dismiss overlay (left swipe) */}
        <animated.div
          style={{ opacity: leftOpacity }}
          className="absolute inset-0 bg-red-500/20 z-20 flex items-center justify-center pointer-events-none rounded-2xl"
        >
          <div className="w-20 h-20 rounded-full bg-red-500/30 flex items-center justify-center border-4 border-red-400">
            <X className="w-10 h-10 text-red-400" />
          </div>
        </animated.div>

        {/* Link overlay (up swipe) */}
        <animated.div
          style={{ opacity: upOpacity }}
          className="absolute inset-0 bg-blue-500/20 z-20 flex items-center justify-center pointer-events-none rounded-2xl"
        >
          <div className="w-20 h-20 rounded-full bg-blue-500/30 flex items-center justify-center border-4 border-blue-400">
            <ExternalLink className="w-10 h-10 text-blue-400" />
          </div>
        </animated.div>

        {/* Card content */}
        <div className="flex flex-col h-full p-5">
          {/* Top row: badges */}
          <div className="flex items-center gap-2 mb-4">
            {deal.is_verified && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-purple-500/15 text-purple-400">
                <BadgeCheck className="w-3.5 h-3.5" />
                Top Pick
              </span>
            )}
            {discount && (
              <span className="ml-auto px-2 py-1 rounded-lg text-xs font-bold bg-green-500/15 text-green-400">
                {discount}% OFF
              </span>
            )}
          </div>

          {/* Brand */}
          <p className="text-xs text-purple-400 uppercase tracking-widest font-bold mb-2">
            {deal.brand?.name || 'Unknown Brand'}
          </p>

          {/* Product name */}
          <h2 className="text-xl font-bold text-white mb-2 line-clamp-3 leading-tight">
            {deal.product_name}
          </h2>

          {/* Meta */}
          <p className="text-sm text-slate-400 mb-auto">
            {deal.weight} &bull; {
              deal.product_subtype === 'disposable' ? 'Disposable Vape'
              : deal.product_subtype === 'cartridge' ? 'Vape Cartridge'
              : deal.product_subtype === 'pod' ? 'Vape Pod'
              : deal.product_subtype === 'infused_preroll' ? 'Infused Pre-Roll'
              : deal.product_subtype === 'preroll_pack' ? 'Pre-Roll Pack'
              : deal.category.charAt(0).toUpperCase() + deal.category.slice(1)
            }
          </p>

          {/* Price block */}
          <div className="mt-6 mb-4">
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-mono font-black text-purple-400">
                ${deal.deal_price}
              </span>
              {deal.original_price && (
                <span className="text-lg text-slate-500 line-through">
                  ${deal.original_price}
                </span>
              )}
            </div>
          </div>

          {/* Dispensary */}
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <MapPin className="w-4 h-4 opacity-60" />
            <span className="truncate">{deal.dispensary?.name || 'Unknown Dispensary'}</span>
          </div>

          {/* Saved indicator */}
          {isSaved && (
            <div className="mt-3 flex items-center gap-1.5 text-purple-400 text-xs font-medium">
              <Heart className="w-3 h-3 fill-current" />
              Saved
            </div>
          )}

          {/* Watermark for screenshots */}
          <p className="text-[8px] text-slate-700 text-right mt-2 select-none">found on cloudeddeals.com</p>
        </div>
      </div>
    </animated.div>
  );
}

function tryHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(10);
  }
}
