import { AdminShell } from "@/components/admin/AdminShell";
import { Notice } from "@/components/admin/ui";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { isAdminRole } from "@/lib/ui/site-content";
import { TEXT_DEFAULTS } from "@/lib/ui/text";
import { textOverrides } from "./store";
import { UiTextEditor } from "./UiTextEditor";

export const dynamic = "force-dynamic";

export default async function UiTextPage() {
  const identity = await getStaffFromHeaders();
  if (!isAdminRole(identity.roles)) {
    return (
      <AdminShell title="UI text">
        <Notice kind="warn">Only an admin can edit UI text.</Notice>
      </AdminShell>
    );
  }
  const overrides = await textOverrides();
  return (
    <AdminShell title="UI text">
      <p className="t-small text-muted" style={{ marginBottom: 16 }}>
        Short labels, buttons and empty-state messages on the listing pages, the home cards and the ad card. Words in curly brackets, like {"{count}"}, are filled in by the site: keep them.
      </p>
      <UiTextEditor defaults={{ ...TEXT_DEFAULTS }} initial={overrides} />
    </AdminShell>
  );
}
