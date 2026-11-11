import { ComingSoon } from "@/components/account/AccountTools";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Publishing packs | Tharkoo",
  description: "Packs will be listed here when they are on sale.",
  path: "/u/account/packs/",
  index: false,
});

export default function Page() {
  return <ComingSoon title="Publishing packs" body="Packs will be listed here when they are on sale." href="/u/account/credits/" label="Open wallet" />;
}
