import { ComingSoon } from "@/components/account/AccountTools";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Settings | Tharkoo",
  description: "Profile editing from this page is coming soon.",
  path: "/u/account/edit-account/",
  index: false,
});

export default function Page() {
  return <ComingSoon title="Settings" body="Profile editing from this page is coming soon." href="/u/account/dashboard/" label="Back to dashboard" />;
}
