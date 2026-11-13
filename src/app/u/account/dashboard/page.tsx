import Link from "next/link";
import { Dashboard } from "@/components/vendor/VendorScreens";
import { UnreadBadge } from "@/components/chat/UnreadBadge";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Dashboard | Tharkoo",
  description: "Your Tharkoo dashboard.",
  path: "/u/account/dashboard/",
  index: false,
});

export default async function Page({ searchParams }: { searchParams: Promise<{ locked?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <div className="tk-container" style={{ paddingTop: 12 }}>
        <Link href="/u/account/messages/" className="tk-btn tk-btn-outline-gold" data-tk="messages-link">
          Messages <UnreadBadge />
        </Link>
      </div>
      <Dashboard locked={sp.locked === "1"} />
    </>
  );
}
