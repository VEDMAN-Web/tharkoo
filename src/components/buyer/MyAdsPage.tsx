import { cookies } from "next/headers";
import { SignedOutPanel, UserPanelShell } from "./UserPanelShell";
import { MyAdsBoard } from "@/components/vendor/MyAdsBoard";
import { SESSION_COOKIE } from "@/server/auth/http";
import { loadPanelSummary } from "@/server/notifications/summary";

export async function MyAdsPage() {
  const summary = await loadPanelSummary((await cookies()).get(SESSION_COOKIE)?.value);
  return (
    <UserPanelShell active="ads" summary={summary}>
      {summary.signedIn ? <MyAdsBoard /> : <SignedOutPanel next="/u/account/ads/" title="Log in to see your ads" body="Your ads and how they are doing show here after you log in." />}
    </UserPanelShell>
  );
}
