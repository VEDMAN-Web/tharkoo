import { ComingSoon } from "@/components/account/AccountTools";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Notifications | Tharkoo",
  description: "Account messages will live here.",
  path: "/u/account/notifications/",
  index: false,
});

export default function Page() {
  return <ComingSoon title="Notifications" body="Account messages will live here." href="/u/account/dashboard/" label="Back to dashboard" />;
}
