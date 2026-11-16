import { WalletHistory } from "@/components/account/AccountTools";
import { PurchaseHistory } from "@/components/recharge/PurchaseHistory";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Credit history | Tharkoo",
  description: "Credit transactions on your Tharkoo account.",
  path: "/u/account/credits/history/",
  index: false,
});

export default function Page() {
  return <WalletHistory purchases={<PurchaseHistory />} />;
}
