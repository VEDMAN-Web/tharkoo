import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { EmptyIcon } from "./UserPanelShell";

export function PanelNotice({ icon, title, body, href, label, tk }: { icon: LucideIcon; title: string; body: string; href: string; label: string; tk: string }) {
  return (
    <section aria-labelledby={`${tk}-title`} className="up-glass up-panel up-empty" data-tk={tk}>
      <EmptyIcon icon={icon} />
      <h1 id={`${tk}-title`} className="up-empty-title">{title}</h1>
      <p className="up-empty-body">{body}</p>
      <Link href={href} className="up-btn">{label}</Link>
    </section>
  );
}
