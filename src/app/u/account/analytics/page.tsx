import { PanelComingSoon, PanelPage } from "@/components/buyer/PanelPage";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Analytics | Tharkoo",
  description: "Listing stats will live here.",
  path: "/u/account/analytics/",
  index: false,
});

export default function Page() {
  return (
    <PanelPage active="ads" next="/u/account/analytics/" title="Log in to see your stats" body="Your ad stats show here after you log in.">
      <PanelComingSoon title="Analytics" body="Listing stats will live here." href="/u/account/ads/" label="View your ads" />
    </PanelPage>
  );
}
