import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/vendor/VendorScreens";
import { NewVendorPanel } from "@/components/vendor/NewVendorPanel";
import { PanelHomePage } from "@/components/buyer/PanelHomePage";
import { pageMetadata } from "@/lib/ui/meta";
import { userFromToken } from "@/server/auth/service";
import { SESSION_COOKIE } from "@/server/auth/http";
import { newDesignOn } from "@/server/site-links/new-design";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Your account | Tharkoo",
  description: "Your Tharkoo account.",
  path: "/u/account/",
  index: false,
});

/**
 * New design: a seller (a seller profile is saved) sees the seller panel (H7.5); everyone else sees the user panel (H7.6).
 * With the switch off, the old dashboard.
 */
export default async function Page() {
  if (!(await newDesignOn())) return <Dashboard />;
  const session = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/u/login/?next=/u/account/");
  if (session.user.seller) return <NewVendorPanel />;
  return <PanelHomePage />;
}
