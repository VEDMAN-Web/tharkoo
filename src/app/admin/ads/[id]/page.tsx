import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { can } from "@/lib/admin/perms";
import { isAdminRole } from "@/lib/ui/site-content";
import { NotFoundError } from "@/server/http";
import { getAdHistory, getStaffAd } from "@/server/listings/staff-edit";
import { AdEditView } from "./AdEditView";
import { CountsForm } from "./CountsForm";

export const dynamic = "force-dynamic";

/** H8.33 (A33): Ad edit. The form, the side cards, the history drawer, and (admins) the shown views and clicks. */
export default async function AdEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const identity = await getStaffFromHeaders();
  if (!can(identity.roles, "ads.view")) {
    return (
      <AdminShell title="Ad" hasHeader>
        <div className="adm-card" style={{ padding: 40, textAlign: "center", display: "grid", gap: 8, justifyItems: "center" }} data-tk="no-access">
          <Lock aria-hidden="true" size={28} />
          <h2 style={{ margin: 0, fontSize: 16 }}>You cannot open this ad</h2>
          <p style={{ margin: 0, maxWidth: "44ch" }}>This screen is for moderators, trust and safety, support and admins. Ask an admin if you need it.</p>
          <Link href="/admin/" className="adm-btn adm-btn-quiet">Back to Dashboard</Link>
        </div>
      </AdminShell>
    );
  }
  let ad;
  try {
    ad = await getStaffAd(identity.roles, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const history = await getAdHistory(identity.roles, id);
  return (
    <AdminShell title={ad.values.title || "Ad"} hasHeader>
      <AdEditView ad={ad} history={history} />
      {isAdminRole(identity.roles) && ad.counts ? (
        <div style={{ marginTop: 16 }} data-tk="ad-counts">
          {ad.slug ? (
            <p className="t-small text-muted">
              <a href={`/ad/${ad.slug}/`} target="_blank" rel="noreferrer">Open the ad</a>
            </p>
          ) : null}
          <CountsForm listingId={id} initial={ad.counts} />
        </div>
      ) : null}
    </AdminShell>
  );
}
