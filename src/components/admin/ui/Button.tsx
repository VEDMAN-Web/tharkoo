import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import "@/styles/admin-kit.css";

export type ButtonKind = "primary" | "secondary" | "quiet" | "danger" | "danger-solid";

type Common = {
  kind?: ButtonKind;
  size?: "md" | "sm";
  icon?: LucideIcon;
  /** Shows a spinner and disables the button. */
  busy?: boolean;
  className?: string;
  children: React.ReactNode;
};

type AsButton = Common & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & { href?: undefined };
type AsLink = Common & { href: string; target?: string; rel?: string; disabled?: boolean; onClick?: React.MouseEventHandler<HTMLAnchorElement> };

export function buttonClass({ kind = "secondary", size = "md", icon = false, className = "" }: { kind?: ButtonKind; size?: "md" | "sm"; icon?: boolean; className?: string }) {
  return ["adm-k-btn", kind === "secondary" ? "" : `adm-k-btn-${kind}`, size === "sm" ? "adm-k-btn-sm" : "", icon ? "adm-k-btn-icon" : "", className].filter(Boolean).join(" ");
}

/**
 * The one button of the admin kit (UI-RULES section 2). A label ends with "..." only when it opens a dialog first.
 * Icon-only is allowed just for Close, Move up, Move down, Remove from slot and Back: use aria-label and title then.
 */
export function Button(props: AsButton | AsLink) {
  const { kind = "secondary", size = "md", icon: Icon, busy = false, className, children } = props;
  const inner = (
    <>
      {busy ? <span className="adm-k-spin" aria-hidden="true" /> : Icon ? <Icon aria-hidden="true" focusable="false" /> : null}
      {children}
    </>
  );
  const cls = buttonClass({ kind, size, className });
  if (props.href !== undefined) {
    const { href, target, rel, disabled, onClick } = props;
    return (
      <Link href={href} className={cls} target={target} rel={rel} aria-disabled={disabled || undefined} onClick={onClick}>
        {inner}
      </Link>
    );
  }
  const rest = { ...props } as Partial<AsButton>;
  delete rest.kind;
  delete rest.size;
  delete rest.icon;
  delete rest.busy;
  delete rest.className;
  delete rest.children;
  delete rest.href;
  return (
    <button type="button" {...rest} className={cls} disabled={rest.disabled || busy} aria-busy={busy || undefined}>
      {inner}
    </button>
  );
}
