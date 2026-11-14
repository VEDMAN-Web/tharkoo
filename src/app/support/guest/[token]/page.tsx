import type { Metadata } from "next";
import { GuestTicket } from "./GuestTicket";

export const dynamic = "force-dynamic";

/**
 * H7.1: a guest's own ticket, opened from the link in the email. The token is in the path, so the page is never
 * indexed, and it sends no referrer to other sites.
 */
export const metadata: Metadata = {
  title: "Tharkoo support",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function GuestTicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="tkn-wrap" style={{ padding: "32px 24px", maxWidth: 720 }}>
      <GuestTicket token={token} />
    </div>
  );
}
