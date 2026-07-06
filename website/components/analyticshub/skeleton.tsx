"use client";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

/** Base shimmer block. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-sunken", className)} />;
}

export function KpiSkeleton() {
  return (
    <Card className="p-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-8 w-24" />
      <Skeleton className="mt-4 h-7 w-full" />
    </Card>
  );
}

export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <Card className="p-4">
      <Skeleton className="h-4 w-32" />
      <div className="mt-4" style={{ height }}>
        <Skeleton className="h-full w-full" />
      </div>
    </Card>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Card className="p-4">
      <Skeleton className="h-4 w-28" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    </Card>
  );
}
