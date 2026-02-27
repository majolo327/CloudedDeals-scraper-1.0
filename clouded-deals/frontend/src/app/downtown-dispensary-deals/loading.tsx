export default function Loading() {
  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: 'var(--surface-0)' }}>
      {/* Header skeleton */}
      <div
        className="sticky top-0 z-50 border-b h-14 sm:h-16"
        style={{ backgroundColor: 'rgba(10, 12, 28, 0.92)', borderColor: 'rgba(120, 100, 200, 0.08)' }}
      />

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Breadcrumb skeleton */}
        <div className="h-4 w-64 rounded bg-white/5 mb-6" />

        {/* Title skeleton */}
        <div className="mb-10">
          <div className="h-8 w-96 rounded bg-white/5 mb-3" />
          <div className="h-4 w-80 rounded bg-white/5 mb-2" />
          <div className="h-4 w-64 rounded bg-white/5" />
        </div>

        {/* Dispensary cards skeleton */}
        <div className="mb-10">
          <div className="h-5 w-48 rounded bg-white/5 mb-4" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border p-4 min-h-[100px]"
                style={{ backgroundColor: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
              >
                <div className="h-4 w-40 rounded bg-white/5 mb-2" />
                <div className="h-3 w-56 rounded bg-white/5" />
              </div>
            ))}
          </div>
        </div>

        {/* Deals table skeleton */}
        <div className="mb-10">
          <div className="h-5 w-64 rounded bg-white/5 mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 rounded bg-white/[0.02]" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
