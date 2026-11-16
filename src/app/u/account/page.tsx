import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/vendor/VendorScreens";
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

/** H7.73: with the New design on, everyone sees the same account home. With the switch off, the old dashboard. */
export default async function Page() {
  if (!(await newDesignOn())) return <Dashboard />;
  const session = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/u/login/?next=/u/account/");
  return <PanelHomePage />;
}
