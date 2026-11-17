import { AdminShell } from "@/components/admin/AdminShell";
import { Notice } from "@/components/admin/ui";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { canEditSite, isAdminRole } from "@/lib/ui/site-content";
import { groupedTextKeys } from "@/lib/ui/text-labels";
import { TEXT_DEFAULTS } from "@/lib/ui/text";
import { MenusTabs } from "../menus/MenusTabs";
import { textOverrides } from "./store";
import { UiTextEditor } from "./UiTextEditor";

export const dynamic = "force-dynamic";

/** H8.47 (A47): Site text. Every word of the site that an admin can change, by area, with a plain name and where it shows. */
export default async function UiTextPage() {
  const identity = await getStaffFromHeaders();
  if (!canEditSite(identity.roles)) {
    return (
      <AdminShell title="Site text">
        <Notice kind="warn">Only an admin can edit the site text.</Notice>
      </AdminShell>
    );
  }
  const overrides = await textOverrides();
  return (
    <AdminShell title="Site text" hasHeader>
      <UiTextEditor groups={groupedTextKeys()} defaults={{ ...TEXT_DEFAULTS }} initial={overrides} tabs={<MenusTabs current="/admin/ui-text/" showMenus={isAdminRole(identity.roles)} />} />
    </AdminShell>
  );
}
