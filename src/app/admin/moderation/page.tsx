import Link from "next/link";
import { Lock } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { can } from "@/lib/admin/perms";
import { NotFoundError } from "@/server/http";
import { getReviewDetail, listReviewTab, parseReviewQuery, type ReviewDetail } from "@/server/moderation/review";
import { ReviewView } from "./_list/ReviewView";

export const dynamic = "force-dynamic";

/** H8.15 (A15): Ads to review. Tab, search, page and the open ad all live in the address. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const identity = await getStaffFromHeaders();
  if (!can(identity.roles, "ads.review")) {
    return (
      <AdminShell title="Ads to review" hasHeader>
        <div className="adm-card" style={{ padding: 40, textAlign: "center", display: "grid", gap: 8, justifyItems: "center" }} data-tk="no-access">
          <Lock aria-hidden="true" size={28} />
          <h2 style={{ margin: 0, fontSize: 16 }}>You cannot open Ads to review</h2>
          <p style={{ margin: 0, maxWidth: "44ch" }}>This screen is for moderators, trust and safety and admins. Ask an admin if you need it.</p>
          <Link href="/admin/" className="adm-btn adm-btn-quiet">Back to Dashboard</Link>
        </div>
      </AdminShell>
    );
  }
  const params = await searchParams;
  const list = await listReviewTab(identity.roles, parseReviewQuery(params));
  const open = typeof params.open === "string" ? params.open : "";
  let detail: ReviewDetail | null = null;
  if (open) {
    try {
      detail = await getReviewDetail(identity.roles, open);
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
    }
  }
  return (
    <AdminShell title="Ads to review" hasHeader>
      <ReviewView list={list} detail={detail} />
    </AdminShell>
  );
}
