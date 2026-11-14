import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { AdminShell } from "@/components/admin/AdminShell";
import { Notice } from "@/components/admin/ui";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { isAdminRole } from "@/lib/ui/site-content";
import { adCountsFor } from "@/server/listings/ad-counts";
import { Listing } from "@/server/models";
import { CountsForm } from "./CountsForm";

export const dynamic = "force-dynamic";

/** H6.17: Admin > All ads > this ad > Views and clicks. */
export default async function AdViewsAndClicks({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const identity = await getStaffFromHeaders();
  if (!isAdminRole(identity.roles)) {
    return (
      <AdminShell title="Views and clicks">
        <Notice kind="warn">Only an admin can change views and clicks.</Notice>
      </AdminShell>
    );
  }
  if (!Types.ObjectId.isValid(id)) notFound();
  await connectDb();
  const ad = await Listing.findById(id).select("title slug status").lean<{ title?: string; slug?: string; status?: string } | null>();
  if (!ad) notFound();
  const counts = await adCountsFor(id);
  return (
    <AdminShell title="Views and clicks">
      <p className="mb-3 t-small text-muted">
        {ad.title || "Ad"} · status {ad.status || "unknown"}
        {ad.slug ? (
          <>
            {" · "}
            <a href={`/ad/${ad.slug}/`} target="_blank" rel="noreferrer">
              Open the ad
            </a>
          </>
        ) : null}
      </p>
      <CountsForm listingId={id} initial={counts} />
    </AdminShell>
  );
}
