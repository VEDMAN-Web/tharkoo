import { cookies } from "next/headers";
import { AdsList } from "@/components/vendor/VendorScreens";
import { NewVendorPanel } from "@/components/vendor/NewVendorPanel";
import { pageMetadata } from "@/lib/ui/meta";
import { userFromToken } from "@/server/auth/service";
import { SESSION_COOKIE } from "@/server/auth/http";
import { newDesignOn } from "@/server/site-links/new-design";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Your ads | Tharkoo",
  description: "Listings on your Tharkoo account.",
  path: "/u/account/ads/",
  index: false,
});

/** H7.5: with the New design on, a seller sees My ads in the seller panel. Others, and the old design, see the list. */
export default async function Page() {
  if (!(await newDesignOn())) return <AdsList />;
  const session = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (session?.user.seller) return <NewVendorPanel />;
  return <AdsList />;
}
