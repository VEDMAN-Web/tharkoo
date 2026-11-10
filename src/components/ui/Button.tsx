import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors duration-200 min-w-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-[image:var(--grad-gold)] text-ink hover:brightness-110",
        secondary: "bg-surface-2 text-text border border-[var(--border-strong)]",
        ghost: "bg-transparent text-muted hover:text-text",
        outline: "bg-transparent text-gold border border-[color:var(--gold-line)]",
        danger: "bg-danger text-ink",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-base",
        lg: "h-[52px] px-5 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type Props = VariantProps<typeof button> & {
  children: React.ReactNode;
  className?: string;
  href?: string;
  type?: "button" | "submit";
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  prefetch?: boolean;
};

export function Button({ variant, size, className, href, children, loading, disabled, type = "button", onClick, prefetch }: Props) {
  const classes = cn(button({ variant, size }), className);
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
