import { ComingSoon } from "@/components/account/AccountTools";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Bank transfer | Tharkoo",
  description: "Bank transfers are coming soon. Buy credits in the wallet if a pack is listed.",
  path: "/u/account/credits/bank/",
  index: false,
});

export default function Page() {
  return <ComingSoon title="Bank transfer" body="Bank transfers are coming soon. Buy credits in the wallet if a pack is listed." href="/u/account/credits/" label="Open wallet" />;
}
