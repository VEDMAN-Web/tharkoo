import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { Clock } from "lucide-react";
import { EmptyIcon, SignedOutPanel, UserPanelShell, type PanelKey } from "./UserPanelShell";
import { SESSION_COOKIE } from "@/server/auth/http";
import { loadPanelSummary } from "@/server/notifications/summary";

export async function PanelPage({ active, next, title, body, children }: { active: PanelKey; next: string; title: string; body: string; children: ReactNode }) {
  const summary = await loadPanelSummary((await cookies()).get(SESSION_COOKIE)?.value);
  return (
    <UserPanelShell active={active} summary={summary}>
      {summary.signedIn ? children : <SignedOutPanel next={next} title={title} body={body} />}
    </UserPanelShell>
  );
}

export function PanelComingSoon({ title, body, href, label }: { title: string; body: string; href: string; label: string }) {
  return (
    <section className="up-glass up-panel up-empty" aria-labelledby="coming-title">
      <EmptyIcon icon={Clock} />
      <h1 id="coming-title" className="up-empty-title">{title}</h1>
      <p className="up-empty-body">Coming soon. {body}</p>
      <Link href={href} className="up-btn">{label}</Link>
    </section>
  );
}
