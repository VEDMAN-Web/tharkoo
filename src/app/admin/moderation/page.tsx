import { AdminShell } from "@/components/admin/AdminShell";
import { EmptyState } from "@/components/admin/ui";
import { connectDb } from "@/lib/db";
import { Category, Listing, Location } from "@/server/models";
import { ModerationRow, type PendingAd } from "./ModerationRow";

export const dynamic = "force-dynamic";
const LIMIT = 100;

export default async function Page() {
  await connectDb();
  const rows = await Listing.find({ status: "pending" }).sort({ createdAt: 1 }).limit(LIMIT).lean();
  const [cats, places] = await Promise.all([
    Category.find({ _id: { $in: rows.map((row) => row.categoryId) } }).select("name").lean<{ _id: unknown; name?: string }[]>(),
    Location.find({ _id: { $in: rows.flatMap((row) => (row.cityId ? [row.cityId] : [])) } }).select("name").lean<{ _id: unknown; name?: string }[]>(),
  ]);
  const nameOf = (list: { _id: unknown; name?: string }[], id: unknown) => list.find((item) => String(item._id) === String(id))?.name || "";
  const ads: PendingAd[] = rows.map((row) => ({
    id: String(row._id),
    title: row.title || "",
    description: row.description || "",
    category: nameOf(cats, row.categoryId),
    city: nameOf(places, row.cityId),
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : "",
  }));
  return (
    <AdminShell title="Moderation queue">
      <p className="mb-3 t-small text-muted">
        Ads waiting for review, oldest first{ads.length === LIMIT ? ` (first ${LIMIT})` : ""}. Approving makes the ad live; rejecting needs a reason.
      </p>
      {ads.length ? (
        <ul className="adm-stack" style={{ listStyle: "none", padding: 0 }}>
          {ads.map((ad) => (
            <ModerationRow key={ad.id} ad={ad} />
          ))}
        </ul>
      ) : (
        <EmptyState title="Nothing to review" why="No ads are waiting for review." />
      )}
    </AdminShell>
  );
}
