import { cookies } from "next/headers";
import { SavedPanel } from "@/components/buyer/SavedPanel";
import { SESSION_COOKIE } from "@/server/auth/http";
import { loadPanelSummary } from "@/server/notifications/summary";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Saved ads | Tharkoo",
  description: "Listings you saved on this device.",
  path: "/u/account/saved/",
  index: false,
});

export default async function Page() {
  const summary = await loadPanelSummary((await cookies()).get(SESSION_COOKIE)?.value);
  return <SavedPanel summary={summary} />;
}
