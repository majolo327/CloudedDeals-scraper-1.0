export default function Loading() {
  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: 'var(--surface-0)' }}>
      {/* Header skeleton */}
      <div
        className="sticky top-0 z-50 border-b h-14 sm:h-16"
        style={{ backgroundColor: 'rgba(10, 14, 26, 0.92)', borderColor: 'var(--border-subtle)' }}
      />

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Breadcrumb skeleton */}
        <div className="h-4 w-48 rounded bg-white/5 mb-6" />

        {/* Title skeleton */}
        <div className="mb-8">
          <div className="h-8 w-80 rounded bg-white/5 mb-3" />
          <div className="h-4 w-64 rounded bg-white/5 mb-2" />
          <div className="h-4 w-96 rounded bg-white/5" />
        </div>

        {/* Category pills skeleton */}
        <div className="flex gap-2 mb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-24 rounded-lg bg-white/5" />
          ))}
        </div>

        {/* Cards skeleton */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border p-4 min-h-[180px]"
              style={{ backgroundColor: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="h-3 w-16 rounded bg-white/5 mb-2" />
              <div className="h-4 w-full rounded bg-white/5 mb-1" />
              <div className="h-4 w-3/4 rounded bg-white/5 mb-3" />
              <div className="h-6 w-20 rounded bg-white/5 mb-3" />
              <div className="flex gap-2">
                <div className="h-5 w-14 rounded bg-white/5" />
                <div className="h-5 w-10 rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
