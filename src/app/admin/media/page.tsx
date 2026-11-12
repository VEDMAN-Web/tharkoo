import { AdminShell } from "@/components/admin/AdminShell";
import { uploadsAvailable } from "@/server/media/config";
import { MediaLibrary } from "./MediaLibrary";

export const dynamic = "force-dynamic";

export default function MediaPage() {
  return (
    <AdminShell title="Media library">
      <MediaLibrary uploadsEnabled={uploadsAvailable()} />
    </AdminShell>
  );
}
