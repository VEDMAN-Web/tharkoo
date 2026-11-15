import Link from "next/link";
import { Dashboard } from "@/components/vendor/VendorScreens";
import { UnreadBadge } from "@/components/chat/UnreadBadge";
import { SupportNotice } from "@/components/support/SupportNotice";
import { PanelHomePage } from "@/components/buyer/PanelHomePage";
import { newDesignOn } from "@/server/site-links/new-design";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Dashboard | Tharkoo",
  description: "Your Tharkoo dashboard.",
  path: "/u/account/dashboard/",
  index: false,
});

export default async function Page({ searchParams }: { searchParams: Promise<{ locked?: string }> }) {
  const sp = await searchParams;
  if (await newDesignOn()) return <PanelHomePage />;
  return (
    <>
      <div className="tk-container" style={{ paddingTop: 12 }}>
        <Link href="/u/account/messages/" className="tk-btn tk-btn-outline-gold" data-tk="messages-link">
          Messages <UnreadBadge />
        </Link>{" "}
        <Link href="/u/account/support/" className="tk-btn tk-btn-outline-gold" data-tk="support-link">
          Support
        </Link>
        <div style={{ marginTop: 12 }}>
          <SupportNotice />
        </div>
      </div>
      <Dashboard locked={sp.locked === "1"} />
    </>
  );
}
