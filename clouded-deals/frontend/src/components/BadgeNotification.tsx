'use client';

import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { BADGES, type BadgeId } from '@/lib/badges';

interface BadgeNotificationProps {
  badgeId: BadgeId;
  onDismiss: () => void;
}

// Simple confetti particle
interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  rotation: number;
  scale: number;
}

function Confetti({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) return;

    const colors = ['#a855f7', '#ec4899', '#f59e0b', '#22c55e', '#3b82f6'];
    const newParticles: Particle[] = [];

    for (let i = 0; i < 30; i++) {
      newParticles.push({
        id: i,
        x: 50 + (Math.random() - 0.5) * 40,
        y: 30 + Math.random() * 20,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        scale: 0.5 + Math.random() * 0.5,
      });
    }

    setParticles(newParticles);

    const timer = setTimeout(() => setParticles([]), 2000);
    return () => clearTimeout(timer);
  }, [active]);

  if (!active || particles.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute w-2 h-2 rounded-sm animate-confetti"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            backgroundColor: p.color,
            transform: `rotate(${p.rotation}deg) scale(${p.scale})`,
            animationDelay: `${Math.random() * 0.3}s`,
          }}
        />
      ))}
    </div>
  );
}

export function BadgeNotification({ badgeId, onDismiss }: BadgeNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const badge = BADGES[badgeId];

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setTimeout(onDismiss, 300);
  }, [onDismiss]);

  useEffect(() => {
    // Animate in
    const showTimer = setTimeout(() => {
      setIsVisible(true);
      setShowConfetti(true);
    }, 100);

    // Auto-dismiss after 5 seconds
    const dismissTimer = setTimeout(() => {
      handleDismiss();
    }, 5000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(dismissTimer);
    };
  }, [handleDismiss]);

  if (!badge) return null;

  const tierColors = {
    bronze: 'from-amber-700 to-amber-600',
    silver: 'from-slate-400 to-slate-300',
    gold: 'from-yellow-500 to-amber-400',
    platinum: 'from-purple-400 to-pink-400',
  };

  return (
    <div
      className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 min-w-[280px]">
        <Confetti active={showConfetti} />

        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 text-slate-500 hover:text-slate-400"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-4">
          {/* Badge icon */}
          <div
            className={`w-16 h-16 rounded-full bg-gradient-to-br ${tierColors[badge.tier]} flex items-center justify-center text-3xl shadow-lg animate-bounce-subtle`}
          >
            {badge.icon}
          </div>

          {/* Badge info */}
          <div className="flex-1">
            <p className="text-xs text-purple-400 font-medium uppercase tracking-wide mb-1">
              Badge Earned!
            </p>
            <h3 className="text-lg font-bold text-white">{badge.name}</h3>
            <p className="text-sm text-slate-400">{badge.description}</p>
          </div>
        </div>

        {/* Tier indicator */}
        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500 capitalize">{badge.tier} tier</span>
          <span className="text-xs text-slate-600">{badge.category}</span>
        </div>
      </div>
    </div>
  );
}

// Queue manager for multiple badge notifications
interface BadgeQueueProps {
  badges: BadgeId[];
  onAllDismissed: () => void;
}

export function BadgeNotificationQueue({ badges, onAllDismissed }: BadgeQueueProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleDismiss = useCallback(() => {
    if (currentIndex < badges.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      onAllDismissed();
    }
  }, [currentIndex, badges.length, onAllDismissed]);

  if (badges.length === 0 || currentIndex >= badges.length) return null;

  return (
    <BadgeNotification
      key={badges[currentIndex]}
      badgeId={badges[currentIndex]}
      onDismiss={handleDismiss}
    />
  );
}
