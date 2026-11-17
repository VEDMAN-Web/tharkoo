import Link from "next/link";
import { Lock } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { isAdminRole } from "@/lib/ui/site-content";
import { NotFoundError } from "@/server/http";
import { listSiteMedia } from "@/server/layout/media";
import { getMediaDetail, mediaTabCounts, type MediaDetail } from "@/server/layout/media-admin";
import { uploadsAvailable } from "@/server/media/config";
import { MediaView } from "./MediaView";
import { MEDIA_PAGE_SIZE, parseMediaTab } from "./media-tabs";
import { VideoReview } from "./VideoReview";

export const dynamic = "force-dynamic";

/** H8.45 (A45): the Media library. Tab, search, page and the open picture live in the address. */
export default async function MediaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const identity = await getStaffFromHeaders();
  if (!isAdminRole(identity.roles)) {
    return (
      <AdminShell title="Media library" hasHeader>
        <div className="adm-card" style={{ padding: 40, textAlign: "center", display: "grid", gap: 8, justifyItems: "center" }} data-tk="no-access">
          <Lock aria-hidden="true" size={28} />
          <h2 style={{ margin: 0, fontSize: 16 }}>You cannot open the Media library</h2>
          <p style={{ margin: 0, maxWidth: "44ch" }}>Only an admin can manage pictures. Ask an admin if you need it.</p>
          <Link href="/admin/" className="adm-btn adm-btn-quiet">Back to Dashboard</Link>
        </div>
      </AdminShell>
    );
  }
  const params = await searchParams;
  const one = (key: string) => (Array.isArray(params[key]) ? (params[key] as string[])[0] : (params[key] as string | undefined)) ?? "";
  const tab = parseMediaTab(one("tab"));
  const q = one("q").trim().slice(0, 80);
  const page = Math.max(1, Math.floor(Number(one("page"))) || 1);
  const list = await listSiteMedia(
    { q, limit: MEDIA_PAGE_SIZE, skip: (page - 1) * MEDIA_PAGE_SIZE, unused: tab === "unused", missingAlt: tab === "missing", trash: tab === "trash" },
    identity.roles,
  );
  const counts = await mediaTabCounts(identity.roles);
  const open = one("open");
  let detail: MediaDetail | null = null;
  if (open) {
    try {
      detail = await getMediaDetail(identity.roles, open);
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
    }
  }
  return (
    <AdminShell title="Media library" hasHeader>
      <MediaView tab={tab} q={q} page={page} total={list.total} items={list.items} counts={counts} detail={detail} uploadsEnabled={uploadsAvailable()} />
      <div style={{ marginTop: 16 }}>
        <VideoReview />
      </div>
    </AdminShell>
  );
}
