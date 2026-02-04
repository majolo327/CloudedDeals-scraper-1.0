'use client';

import { useState } from 'react';
import { MapPin, X, Bell } from 'lucide-react';

export function LocationSelector() {
  const [isEditing, setIsEditing] = useState(false);
  const [zipInput, setZipInput] = useState('');
  const [showComingSoon, setShowComingSoon] = useState(false);

  const handleZipSubmit = () => {
    if (zipInput.length !== 5) return;
    setShowComingSoon(true);
    setIsEditing(false);
    setZipInput('');
  };

  return (
    <>
      {isEditing ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={zipInput}
            onChange={(e) => setZipInput(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="Zip code"
            className="w-24 sm:w-28 px-2 sm:px-3 py-2 min-h-[40px] text-sm bg-slate-800 border border-purple-500 rounded-lg text-white placeholder:text-slate-500 focus:outline-none"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleZipSubmit();
              if (e.key === 'Escape') setIsEditing(false);
            }}
          />
          <button
            onClick={handleZipSubmit}
            className="p-2 min-w-[40px] min-h-[40px] text-xs sm:text-sm text-purple-400 hover:text-purple-300 font-medium"
          >
            Go
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-1 p-1.5 min-h-[40px] text-xs sm:text-sm text-white hover:text-purple-400 transition-colors"
        >
          <MapPin className="w-3.5 h-3.5" />
          <span className="underline underline-offset-2 decoration-purple-500/50 truncate max-w-[80px] sm:max-w-none">
            Las Vegas
          </span>
        </button>
      )}

      {showComingSoon && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowComingSoon(false)}
        >
          <div
            className="bg-slate-800 rounded-2xl w-full max-w-xs p-5 text-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowComingSoon(false)}
              className="absolute top-3 right-3 p-1 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 bg-purple-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-6 h-6 text-purple-400" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Vegas only — for now</h2>
            <p className="text-sm text-slate-400 mb-5 leading-relaxed">
              We&apos;re expanding soon. Check out Vegas deals or drop your email to get notified.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => setShowComingSoon(false)}
                className="w-full py-3 bg-purple-500 hover:bg-purple-400 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                Browse Vegas Deals
              </button>
              <button
                onClick={() => {
                  window.open('mailto:hello@cloudeddeals.com?subject=Notify me when you expand', '_blank');
                  setShowComingSoon(false);
                }}
                className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
              >
                <Bell className="w-4 h-4" />
                Notify me
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
