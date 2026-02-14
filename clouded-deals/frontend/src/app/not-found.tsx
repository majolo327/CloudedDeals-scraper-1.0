import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-purple-400 mb-4">404</h1>
        <h2 className="text-xl font-semibold text-white mb-3">
          Page not found
        </h2>
        <p className="text-slate-400 text-sm mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-purple-500 hover:bg-purple-400 text-white font-semibold rounded-xl transition-colors"
        >
          View Today&apos;s Deals
        </Link>
      </div>
    </div>
  );
}
