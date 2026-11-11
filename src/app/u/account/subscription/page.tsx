import { ComingSoon } from "@/components/account/AccountTools";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Subscription | Tharkoo",
  description: "Subscriptions are not on sale yet.",
  path: "/u/account/subscription/",
  index: false,
});

export default function Page() {
  return <ComingSoon title="Subscription" body="Subscriptions are not on sale yet." href="/u/account/dashboard/" label="Back to dashboard" />;
}
