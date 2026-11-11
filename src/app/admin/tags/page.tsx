import { TagsEditor } from "@/components/admin/TagsEditor";
import { publicTags } from "@/server/urls/service";

export const dynamic = "force-dynamic";

export default async function TagsAdminPage() {
  const tags = await publicTags().catch(() => []);
  const initial = tags.map((tag) => `${tag.slug}, ${tag.label}`).join("\n");
  return <TagsEditor initial={initial} />;
}
