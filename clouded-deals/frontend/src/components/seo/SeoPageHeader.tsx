import Link from 'next/link';

export function SeoPageHeader() {
  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-xl border-b"
      style={{
        backgroundColor: 'rgba(10, 14, 26, 0.92)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
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
