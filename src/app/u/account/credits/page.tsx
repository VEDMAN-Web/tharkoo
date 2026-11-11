import { WalletPanel } from "@/components/account/AccountTools";
import { getCreditPacks } from "@/lib/queries";
import { pageMetadata } from "@/lib/ui/meta";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Wallet | Tharkoo",
  description: "Your Tharkoo credit balance.",
  path: "/u/account/credits/",
  index: false,
});

export default async function Page() {
  const packs = await getCreditPacks();
  return (
    <WalletPanel
      packs={packs.map((pack) => ({
        id: String(pack._id),
        credits: pack.credits ?? 0,
        price: pack.price ?? 0,
        bonus: pack.bonus,
        tag: pack.tag,
      }))}
    />
  );
}
