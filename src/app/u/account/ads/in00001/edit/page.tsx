import { ComingSoon } from "@/components/account/AccountTools";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Edit ad | Tharkoo",
  description: "Editing from this address is coming soon. Open your ads list.",
  path: "/u/account/ads/in00001/edit/",
  index: false,
});

export default function Page() {
  return <ComingSoon title="Edit ad" body="Editing from this address is coming soon. Open your ads list." href="/u/account/ads/" label="Your ads" />;
}
