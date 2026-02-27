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
        <div className="h-4 w-32 rounded bg-white/5 mb-6" />

        {/* Title skeleton */}
        <div className="mb-10">
          <div className="h-8 w-72 rounded bg-white/5 mb-3" />
          <div className="h-4 w-96 rounded bg-white/5" />
        </div>

        {/* Post card skeletons */}
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border p-5 min-h-[180px]"
              style={{ backgroundColor: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="h-4 w-14 rounded bg-white/5" />
                <div className="h-3 w-16 rounded bg-white/5" />
              </div>
              <div className="h-5 w-full rounded bg-white/5 mb-2" />
              <div className="h-4 w-5/6 rounded bg-white/5 mb-3" />
              <div className="h-3 w-28 rounded bg-white/5" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
