import Link from 'next/link';

export function SeoPageHeader() {
  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-2xl header-border-glow"
      style={{
        backgroundColor: 'rgba(10, 12, 28, 0.92)',
        borderBottom: '1px solid rgba(120, 100, 200, 0.08)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="focus:outline-none">
          <span className="text-lg sm:text-xl font-bold tracking-tight">
            Clouded<span className="text-purple-400">Deals</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/las-vegas-dispensary-deals"
            className="px-3 py-2 text-slate-400 hover:text-white transition-colors rounded-lg"
          >
            Deals
          </Link>
          <Link
            href="/browse"
            className="px-3 py-2 text-slate-400 hover:text-white transition-colors rounded-lg hidden sm:block"
          >
            Browse
          </Link>
          <Link
            href="/search"
            className="px-3 py-2 text-slate-400 hover:text-white transition-colors rounded-lg"
          >
            Search
          </Link>
          <Link
            href="/"
            className="ml-2 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg font-medium hover:bg-purple-500/30 transition-colors"
          >
            Open App
          </Link>
        </nav>
      </div>
    </header>
  );
}
