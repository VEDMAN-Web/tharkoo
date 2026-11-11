import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-lg", className)} style={{ background: "var(--bg-soft)" }} />;
}

export function AdCardSkeleton() {
  return (
    <div className="tk-card" aria-hidden>
      <Skeleton className="h-[180px] w-[140px] shrink-0 rounded-none" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
