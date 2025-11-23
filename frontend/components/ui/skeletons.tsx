import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * CardSkeleton - Loading placeholder for PostCard
 * Matches the exact layout and dimensions of a PostCard component
 */
export function CardSkeleton() {
  return (
    <Card className="bg-card border-border shadow-xl overflow-hidden">
      {/* HEADER: User Identity + Ticker */}
      <CardHeader className="pb-4 space-y-3">
        <div className="flex items-start justify-between">
          {/* Left: User Info */}
          <div className="flex items-center gap-3">
            {/* Avatar Circle */}
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex flex-col gap-2">
              {/* Username */}
              <Skeleton className="h-4 w-24" />
              {/* Date */}
              <Skeleton className="h-3 w-32" />
            </div>
          </div>

          {/* Right: Ticker + Logo */}
          <div className="flex items-center gap-2">
            {/* Stock Logo */}
            <Skeleton className="w-10 h-10 rounded-lg" />
            {/* Ticker Symbol */}
            <Skeleton className="h-8 w-16" />
          </div>
        </div>

        {/* User's Thesis Badge */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>

        {/* Financial Dashboard Skeleton */}
        <div className="mt-3 p-3 bg-muted/30 rounded-lg border border-border">
          <div className="flex items-start gap-4">
            {/* Sparkline Chart */}
            <div className="flex-shrink-0">
              <Skeleton className="h-3 w-20 mb-1" />
              <Skeleton className="w-[120px] h-[40px]" />
            </div>

            {/* Financial Metrics Grid */}
            <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2">
              {/* P/E Ratio */}
              <div>
                <Skeleton className="h-3 w-16 mb-1" />
                <Skeleton className="h-4 w-12" />
              </div>

              {/* Market Cap */}
              <div>
                <Skeleton className="h-3 w-16 mb-1" />
                <Skeleton className="h-4 w-16" />
              </div>

              {/* Beta */}
              <div>
                <Skeleton className="h-3 w-12 mb-1" />
                <Skeleton className="h-4 w-12" />
              </div>

              {/* 52W High */}
              <div>
                <Skeleton className="h-3 w-16 mb-1" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      {/* CONTENT: User's Post */}
      <CardContent className="pb-6 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </CardContent>

      {/* FOOTER: AI Intelligence Zone */}
      <CardFooter className="bg-muted/50 border-t border-border flex-col items-start gap-4 py-4">
        {/* AI Header with Scores */}
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="w-5 h-5 rounded" />
            <Skeleton className="h-4 w-32" />
          </div>
          
          <div className="flex items-center gap-2">
            <Skeleton className="w-4 h-4 rounded" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="w-4 h-4 rounded" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>

        {/* AI Summary Text */}
        <div className="w-full space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </CardFooter>

      {/* ACTIONS: Like/Comment Buttons */}
      <div className="border-t border-border p-4 flex items-center gap-6">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </Card>
  );
}

/**
 * SidebarSkeleton - Loading placeholder for Market Sidebar
 * Includes stock price rows and news items
 */
export function SidebarSkeleton() {
  return (
    <div className="space-y-4">
      {/* Stock Prices Section */}
      <div className="space-y-2">
        <Skeleton className="h-5 w-32 mb-3" />
        {[...Array(5)].map((_, i) => (
          <div key={`stock-${i}`} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="text-right space-y-1">
              <Skeleton className="h-4 w-16 ml-auto" />
              <Skeleton className="h-3 w-12 ml-auto" />
            </div>
          </div>
        ))}
      </div>

      {/* News Section */}
      <div className="space-y-2 pt-4 border-t border-border">
        <Skeleton className="h-5 w-40 mb-3" />
        {[...Array(3)].map((_, i) => (
          <div key={`news-${i}`} className="p-3 rounded-lg bg-muted/30 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="flex items-center gap-2 pt-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * FeedSkeleton - Loading state for the main feed
 * Renders multiple CardSkeleton components
 */
export function FeedSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-6">
      {[...Array(count)].map((_, i) => (
        <CardSkeleton key={`skeleton-${i}`} />
      ))}
    </div>
  );
}
