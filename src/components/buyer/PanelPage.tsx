import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { SignedOutPanel, UserPanelShell, type PanelKey } from "./UserPanelShell";
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
