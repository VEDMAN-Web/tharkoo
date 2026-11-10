import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  new: "border border-[color:var(--gold-line)] text-gold bg-transparent",
  highlight: "border border-[color:var(--gold-line)] text-gold bg-transparent",
  top: "bg-[image:var(--grad-gold)] text-ink",
  supertop: "bg-[image:var(--grad-gold)] text-ink",
  star: "bg-[image:var(--grad-gold)] text-ink",
  verified: "bg-success/15 text-success border border-success/40",
  live: "bg-success/15 text-success",
};

export function Badge({
  tone = "new",
  children,
  className,
}: {
  tone?: keyof typeof styles | string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-pill px-2 t-caption uppercase tracking-wide",
        styles[tone] || styles.new,
        className,
      )}
    >
      {children}
    </span>
  );
}
