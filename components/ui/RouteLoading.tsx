import { Skeleton, SkeletonCard, SkeletonStatCard } from './Skeleton'

/**
 * Full-route loading shell used by route-level loading.tsx files so
 * navigation shows an instant skeleton instead of a blank screen.
 */
export function RouteLoading({
  variant = 'list',
}: {
  variant?: 'list' | 'stats' | 'form'
}) {
  return (
    <div className="relative min-h-screen bg-brand-dark">
      <main className="relative z-10 max-w-6xl mx-auto p-4 space-y-6 pt-6">
        <div className="flex items-center justify-between">
          <Skeleton variant="rectangular" className="h-8 w-44" />
          <Skeleton variant="rounded" className="h-10 w-28" />
        </div>

        {variant === 'stats' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
          </div>
        )}

        {variant === 'form' ? (
          <>
            <SkeletonCard className="h-40" />
            <SkeletonCard className="h-56" />
            <SkeletonCard className="h-32" />
          </>
        ) : (
          <>
            <SkeletonCard className="h-32" />
            <SkeletonCard className="h-32" />
            <SkeletonCard className="h-32" />
          </>
        )}
      </main>
    </div>
  )
}

export default RouteLoading
