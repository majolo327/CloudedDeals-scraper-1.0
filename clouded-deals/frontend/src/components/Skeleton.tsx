interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`rounded-lg ${className}`}
      style={{
        background: 'linear-gradient(90deg, rgba(45,50,80,0.4) 25%, rgba(65,60,100,0.45) 50%, rgba(45,50,80,0.4) 75%)',
        backgroundSize: '200% 100%',
        border: '1px solid rgba(120, 100, 200, 0.06)',
        animation: 'skeletonGlow 2s ease-in-out infinite',
      }}
    />
  );
}

export function DealCardSkeleton() {
  return (
    <div className="glass frost rounded-2xl p-3 min-h-[140px]" role="status" aria-label="Loading deal">
      <div className="flex items-start justify-between gap-2 mb-2">
        <Skeleton className="w-16 h-3 rounded" />
        <Skeleton className="w-4 h-4 rounded" />
      </div>
      <Skeleton className="w-3/4 h-4 mb-2 rounded" />
      <Skeleton className="w-1/2 h-3 mb-4 rounded" />
      <div className="flex items-end justify-between mt-auto">
        <Skeleton className="w-12 h-5 rounded" />
        <Skeleton className="w-8 h-8 rounded-lg" />
      </div>
      <Skeleton className="w-20 h-2 mt-2 rounded" />
    </div>
  );
}

export function TopPickSkeleton() {
  return (
    <div className="glass frost rounded-2xl p-4" role="status" aria-label="Loading top pick">
      <div className="flex items-center gap-4">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <Skeleton className="w-20 h-4 rounded" />
        <div className="flex-1" />
        <Skeleton className="w-16 h-6 rounded" />
        <Skeleton className="w-8 h-8 rounded-lg" />
      </div>
    </div>
  );
}
