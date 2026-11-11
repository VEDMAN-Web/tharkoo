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
  const classes = cn("tk-filter", selected && "is-on", className);
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
  return <div className="tk-filters">{children}</div>;
}
