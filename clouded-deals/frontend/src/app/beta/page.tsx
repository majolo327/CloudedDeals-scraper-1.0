import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Beta Tester Guide | CloudedDeals',
  description:
    'Welcome to the CloudedDeals beta. Learn how the app works and what to look for as a tester.',
  robots: { index: false, follow: false },
};

export default function BetaPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-2xl mx-auto px-5 py-12 sm:py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/15 text-purple-300 border border-purple-500/20 mb-4">
            Beta Tester
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Welcome to{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">
              CloudedDeals
            </span>
          </h1>
          <p className="text-slate-400 text-lg">
            Every deal. Every dispensary. One place.
          </p>
        </div>

        {/* How it works */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">How It Works</h2>
          <div className="space-y-4">
            {[
              {
                num: '1',
                title: 'We scrape every morning',
                desc: 'At 8 AM PT, we visit every dispensary menu in Las Vegas and extract every deal.',
              },
              {
                num: '2',
                title: 'We score and rank',
                desc: 'Our algorithm scores each deal based on discount depth, brand quality, and category. The top 200 make the cut.',
              },
              {
                num: '3',
                title: 'You find the best price',
                desc: 'Browse by category, search by brand, or swipe through deals. Tap any deal to go straight to the dispensary.',
              },
            ].map((step) => (
              <div
                key={step.num}
                className="flex gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0 text-sm font-bold text-purple-400">
                  {step.num}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white mb-0.5">
                    {step.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* What to look for */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">
            What to Look For as a Tester
          </h2>
          <div className="space-y-3 text-sm text-slate-400 leading-relaxed">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <h3 className="font-semibold text-white mb-1">Deal Accuracy</h3>
              <p>
                Do the prices match what you see on the dispensary site? Tap
                &ldquo;Get Deal&rdquo; and compare. If something looks off, tap the flag
                icon to report it.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <h3 className="font-semibold text-white mb-1">
                Missing Deals or Dispensaries
              </h3>
              <p>
                Know a deal we missed? See a dispensary that should be listed?
                Use the feedback widget (bottom-right corner) to tell us.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <h3 className="font-semibold text-white mb-1">
                Search &amp; Filters
              </h3>
              <p>
                Try searching for your favorite brand or strain. Filter by
                category (flower, vapes, edibles, concentrates, pre-rolls). Does
                it find what you expect?
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <h3 className="font-semibold text-white mb-1">
                Save &amp; Share
              </h3>
              <p>
                Save deals with the heart icon. Share your saved list with a
                friend using the share button on the Saved tab. Does it work
                smoothly?
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <h3 className="font-semibold text-white mb-1">
                Mobile Experience
              </h3>
              <p>
                This app is built mobile-first. Try it on your phone. Does it
                feel fast? Is anything hard to tap? Does the swipe mode work?
              </p>
            </div>
          </div>
        </section>

        {/* Expectations */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">What to Expect</h2>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-0.5">&#x2022;</span>
              Deals refresh every morning around 8 AM PT
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-0.5">&#x2022;</span>
              Some dispensaries may be missing — we&apos;re adding more weekly
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-0.5">&#x2022;</span>
              No account needed — your saves persist on your device
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-0.5">&#x2022;</span>
              We don&apos;t sell cannabis — we show you where the deals are
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-0.5">&#x2022;</span>
              Your feedback directly shapes what we build next
            </li>
          </ul>
        </section>

        {/* CTA */}
        <div className="text-center mb-10">
          <Link
            href="/"
            className="inline-block px-8 py-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-bold rounded-2xl transition-all text-base shadow-lg shadow-purple-500/25"
          >
            Browse Today&apos;s Deals
          </Link>
        </div>

        {/* Contact */}
        <div className="text-center border-t border-slate-800/50 pt-8">
          <p className="text-xs text-slate-500 mb-2">
            Questions, bugs, or ideas? Reach us anytime:
          </p>
          <a
            href="mailto:hello@cloudeddeals.com"
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            hello@cloudeddeals.com
          </a>
          <p className="text-xs text-slate-600 mt-6">
            For adults 21+ only. CloudedDeals is not a licensed cannabis retailer.
          </p>
        </div>
      </div>
    </div>
  );
}
