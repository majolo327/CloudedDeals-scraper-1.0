export default function Loading() {
  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: 'var(--surface-0)' }}>
      {/* Header skeleton */}
      <div
        className="sticky top-0 z-50 border-b h-14 sm:h-16"
        style={{ backgroundColor: 'rgba(10, 12, 28, 0.92)', borderColor: 'rgba(120, 100, 200, 0.08)' }}
      />

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Breadcrumb skeleton */}
        <div className="h-4 w-48 rounded bg-white/5 mb-6" />

        {/* Category + reading time */}
        <div className="flex items-center gap-2 mb-4">
          <div className="h-4 w-14 rounded bg-white/5" />
          <div className="h-3 w-16 rounded bg-white/5" />
        </div>

        {/* Title skeleton */}
        <div className="h-8 w-full rounded bg-white/5 mb-3" />
        <div className="h-4 w-3/4 rounded bg-white/5 mb-4" />
        <div className="h-3 w-32 rounded bg-white/5 mb-8" />

        {/* Article body skeletons */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="mb-8">
            <div className="h-5 w-56 rounded bg-white/5 mb-3" />
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-white/5" />
              <div className="h-3 w-full rounded bg-white/5" />
              <div className="h-3 w-5/6 rounded bg-white/5" />
              <div className="h-3 w-full rounded bg-white/5" />
              <div className="h-3 w-2/3 rounded bg-white/5" />
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
