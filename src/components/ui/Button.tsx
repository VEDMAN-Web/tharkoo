import Link from "next/link";
import { cn } from "@/lib/utils";

const look: Record<string, string> = {
  primary: "tk-btn tk-btn-rose",
  secondary: "tk-btn tk-btn-outline-rose",
  ghost: "tk-btn tk-btn-grey",
  outline: "tk-btn tk-btn-outline-primary",
  danger: "tk-btn tk-btn-rose",
};

export function Button({
  variant = "primary",
  className,
  href,
  children,
  loading,
  disabled,
  type = "button",
  onClick,
  prefetch,
}: {
  variant?: keyof typeof look | "primary" | "secondary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  className?: string;
  href?: string;
  type?: "button" | "submit";
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  prefetch?: boolean;
}) {
  const classes = cn(look[variant] || look.primary, className);
  const inner = (
    <>
      {loading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : null}
      {children}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={classes} aria-busy={loading || undefined} prefetch={prefetch} onClick={onClick}>
        {inner}
      </Link>
    );
  }
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} onClick={onClick}>
      {inner}
    </button>
  );
}
