import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
}: {
  tone?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn("tk-chip", className)}>{children}</span>;
}
