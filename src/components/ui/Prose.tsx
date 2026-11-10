import { cn } from "@/lib/utils";

export function Prose({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("prose-block t-body", className)}>{children}</div>;
}
