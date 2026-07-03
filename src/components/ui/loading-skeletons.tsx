import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

/** Row skeleton for list-style screens: Sales history, Stock entries, Credit list */
export function SkeletonRowList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="border-border/50 shadow-sm">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-2/5" />
                  <Skeleton className="h-2.5 w-1/4" />
                </div>
              </div>
              <div className="space-y-1.5 shrink-0 text-right">
                <Skeleton className="h-3.5 w-14 ml-auto" />
                <Skeleton className="h-2.5 w-10 ml-auto" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/** Stat-grid skeleton for Analytics: header icon + title, then a grid of stat cards */
export function SkeletonAnalytics() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/50 shadow-sm">
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  )
}

/** Podium + list skeleton for Leaderboard */
export function SkeletonLeaderboard() {
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-center gap-3">
        <Skeleton className="h-24 w-20 rounded-xl" />
        <Skeleton className="h-32 w-20 rounded-xl" />
        <Skeleton className="h-20 w-20 rounded-xl" />
      </div>
      <SkeletonRowList count={3} />
    </div>
  )
}

/** Generic full-tab skeleton, used as the Suspense fallback while a tab's code/data loads */
export function SkeletonPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <SkeletonRowList count={3} />
    </div>
  )
}
