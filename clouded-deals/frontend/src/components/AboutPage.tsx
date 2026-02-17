'use client';

export function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto px-5 py-12 sm:py-16">
      <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6 leading-tight">
        Every deal. Every dispensary.{' '}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-purple-400">
          One place.
        </span>
      </h2>

      <div className="space-y-4 text-sm sm:text-base text-slate-400 leading-relaxed">
        <p>
          We check every dispensary in Las Vegas every single morning and bring
          every deal into one place.
        </p>

        <p>
          No accounts required. No sponsored placements. Every deal is
          ranked on its own merit.
        </p>

        <p>
          We built this because we were tired of opening 10 different apps and
          scrolling through 10 different menus just to find out who has the best
          price on a cart today.
        </p>

        <p>So we fixed it.</p>

        <p className="text-white font-semibold">
          Clouded Deals is free for consumers.
        </p>
      </div>

      {/* Trust commitment */}
      <div className="mt-10 p-5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
          Every deal is ranked on merit. No sponsored placements.
        </p>
      </div>

      <p className="mt-10 text-sm text-slate-600">Built in Las Vegas.</p>
    </div>
  );
}
