import { AdminShell } from "@/components/admin/AdminShell";
import { uploadsAvailable } from "@/server/media/config";
import { MediaLibrary } from "./MediaLibrary";
import { VideoReview } from "./VideoReview";

export const dynamic = "force-dynamic";

export default function MediaPage() {
  return (
    <AdminShell title="Media library">
      <MediaLibrary uploadsEnabled={uploadsAvailable()} />
      <div style={{ marginTop: 16 }}>
        <VideoReview />
      </div>
    </AdminShell>
  );
}
