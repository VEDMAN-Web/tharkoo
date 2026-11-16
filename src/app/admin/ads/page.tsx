import Link from "next/link";
import type { Types } from "mongoose";
import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";
import { formatIndianCount } from "@/components/ad/counts-format";
import { connectDb } from "@/lib/db";
import { shownFrom } from "@/server/analytics/shown";
import { AdCounter } from "@/server/models/ad-event";
import { Listing } from "@/server/models";
import { DEMO_SLUG, demoAdCounts, demoFilter } from "@/server/listings/demo-ads";
import { homePickerData } from "@/server/listings/home-selection";
import { DemoAds } from "./DemoAds";
import { HomeSelection } from "./HomeSelection";

export const dynamic = "force-dynamic";

const RECENT = 50;

/** H6.17: the newest ads with their shown and real views and clicks. Opens the Views and clicks form for each. */
async function recentCounts(kind: "all" | "demo" | "real") {
  await connectDb();
  const demo = kind === "all" ? null : await demoFilter();
  const query = kind === "demo" ? (demo ?? { _id: null }) : kind === "real" && demo ? { $nor: [demo] } : {};
  const ads = await Listing.find(query)
    .sort({ updatedAt: -1 })
    .limit(RECENT)
    .select("title status slug updatedAt")
    .lean<{ _id: Types.ObjectId; title?: string; status?: string; slug?: string }[]>();
  const counters = await AdCounter.find({ listingId: { $in: ads.map((ad) => ad._id) } }).lean<{ listingId: Types.ObjectId; realViews?: number; realClicks?: number; viewsSet?: number; viewsRealAtSet?: number; clicksSet?: number; clicksRealAtSet?: number }[]>();
  const byId = new Map(counters.map((row) => [String(row.listingId), row]));
  return ads.map((ad) => {
    const counter = byId.get(String(ad._id));
    return {
      id: String(ad._id),
      title: ad.title || "Untitled",
      status: ad.status || "",
      demo: DEMO_SLUG.test(ad.slug || ""),
      shown: shownFrom(counter),
      real: { views: counter?.realViews ?? 0, clicks: counter?.realClicks ?? 0 },
    };
  });
}

export default async function Page({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind: rawKind } = await searchParams;
  const kind = rawKind === "demo" || rawKind === "real" ? rawKind : "all";
  const [rows, picker, demoCounts] = await Promise.all([recentCounts(kind), homePickerData(), demoAdCounts()]);
  return (
    <AdminShell title="Ads">
      <p className="mb-3 t-small text-muted">Full ad records. Change title, photos, variant, city and status. The public feed updates.</p>
      <HomeSelection pinned={picker.pinned} results={picker.results} />
      <DemoAds total={demoCounts.total} active={demoCounts.active} />
      <section className="adm-card" aria-labelledby="ad-counts-heading" style={{ marginBottom: 16 }}>
        <h2 id="ad-counts-heading" className="t-h4">Views and clicks</h2>
        <p className="t-small text-muted">
          {kind === "demo" ? "Demo ads only. " : kind === "real" ? "Real ads only. " : ""}The {RECENT} most recently changed ads. Shown is the number visitors see. Real is what visitors have actually done. Open an ad to set its shown numbers.
        </p>
        {rows.length === 0 ? (
          <p className="t-small text-muted">No ads yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="t-small" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th scope="col">Ad</th>
                  <th scope="col">Status</th>
                  <th scope="col" style={{ textAlign: "right" }}>Shown views</th>
                  <th scope="col" style={{ textAlign: "right" }}>Shown clicks</th>
                  <th scope="col" style={{ textAlign: "right" }}>Real views</th>
                  <th scope="col" style={{ textAlign: "right" }}>Real clicks</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "6px 8px 6px 0" }}>
                      <Link href={`/admin/ads/${row.id}/`}>{row.title}</Link>
                    </td>
                    <td>{row.status}{row.demo ? " · Demo" : ""}</td>
                    <td style={{ textAlign: "right" }}>{formatIndianCount(row.shown.views)}</td>
                    <td style={{ textAlign: "right" }}>{formatIndianCount(row.shown.clicks)}</td>
                    <td style={{ textAlign: "right" }}>{formatIndianCount(row.real.views)}</td>
                    <td style={{ textAlign: "right" }}>{formatIndianCount(row.real.clicks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <CollectionEditor model="Listing" title="Ads" />
    </AdminShell>
  );
}
