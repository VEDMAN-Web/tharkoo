import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-lg bg-surface-2", className)} />;
}

export function AdCardSkeleton() {
  return (
    <div className="flex overflow-hidden rounded-lg border border-line bg-surface" aria-hidden>
      <Skeleton className="h-[180px] w-36 shrink-0 rounded-none md:h-[250px] md:w-[200px]" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="hidden h-10 w-full md:block" />
      </div>
    </div>
  );
}
