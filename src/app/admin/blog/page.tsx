import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Blog editor">
      <p className="mb-3 t-small text-muted">
        Blog posts. For a cover picture, add three fields to the post: cover (an https image address), coverAlt (what the picture shows) and coverFocus
        (the part to keep when it is cropped, for example 60% 40%). With no cover the post keeps the pink band.
      </p>
      <CollectionEditor model="BlogPost" title="Blog editor" />
    </AdminShell>
  );
}
