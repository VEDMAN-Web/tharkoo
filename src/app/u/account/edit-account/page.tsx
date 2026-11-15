import { cookies } from "next/headers";
import { SettingsPanel } from "@/components/buyer/SettingsPanel";
import { SESSION_COOKIE } from "@/server/auth/http";
import { loadPanelSummary } from "@/server/notifications/summary";
import { pageMetadata } from "@/lib/ui/meta";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Settings | Tharkoo",
  description: "Your Tharkoo name, email, and identity status.",
  path: "/u/account/edit-account/",
  index: false,
});

export default async function Page() {
  const summary = await loadPanelSummary((await cookies()).get(SESSION_COOKIE)?.value);
  return <SettingsPanel summary={summary} />;
}
