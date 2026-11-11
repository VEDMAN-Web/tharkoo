import { cn } from "@/lib/utils";

export function IconButton({
  label,
  children,
  className,
  onClick,
  type = "button",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-grid size-11 place-items-center rounded-full text-text hover:bg-surface-2",
        className,
      )}
    >
      {children}
    </button>
  );
}
