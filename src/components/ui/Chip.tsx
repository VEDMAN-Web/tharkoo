import Link from "next/link";
import { cn } from "@/lib/utils";

export function Chip({
  children,
  selected,
  href,
  onClick,
  className,
}: {
  children: React.ReactNode;
  selected?: boolean;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const classes = cn(
    "inline-flex h-9 shrink-0 snap-start items-center rounded-pill border px-3 t-small",
    selected ? "border-[color:var(--gold-line)] bg-[var(--gold-soft)] text-gold" : "border-line bg-surface text-muted",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={classes} prefetch={false} aria-current={selected ? "true" : undefined}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 overflow-x-auto scroll-smooth snap-x snap-proximity [-webkit-overflow-scrolling:touch] pb-1">
      {children}
    </div>
  );
}
