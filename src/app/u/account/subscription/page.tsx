import { PanelComingSoon, PanelPage } from "@/components/buyer/PanelPage";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Subscription | Tharkoo",
  description: "Subscriptions are not on sale yet.",
  path: "/u/account/subscription/",
  index: false,
});

export default function Page() {
  return (
    <PanelPage active="settings" next="/u/account/subscription/" title="Log in to see your subscription" body="Your subscription shows here after you log in.">
      <PanelComingSoon title="Subscription" body="Subscriptions are not on sale yet." href="/u/account/" label="Back to my account" />
    </PanelPage>
  );
}
