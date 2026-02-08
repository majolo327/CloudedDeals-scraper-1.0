interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`rounded ${className}`}
      style={{
        background: 'linear-gradient(90deg, rgba(51,65,85,0.4) 25%, rgba(71,85,105,0.5) 50%, rgba(51,65,85,0.4) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmerSoft 1.5s ease-in-out infinite',
      }}
    />
  );
}

export function DealCardSkeleton() {
  return (
    <div className="glass frost rounded-xl p-3 min-h-[140px]">
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
    <div className="glass frost rounded-xl p-4">
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
