import { AdminShell } from "@/components/admin/AdminShell";
import { SiteContentForm } from "@/components/admin/SiteContentForm";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { isAdminRole, readContent } from "@/lib/ui/site-content";
import { ensureHomepageDocument } from "@/lib/ui/site-store";
import { Site } from "@/server/models";

export const dynamic = "force-dynamic";

export default async function MenusAdminPage() {
  const identity = await getStaffFromHeaders();
  if (!isAdminRole(identity.roles)) {
    return (
      <AdminShell title="Menus">
        <p>Only an admin can edit the menus.</p>
      </AdminShell>
    );
  }
  await ensureHomepageDocument();
  await connectDb();
  const site = await Site.findOne({ key: "default" }).lean();
  return (
    <AdminShell title="Menus">
      <p className="mb-4 t-small text-muted">
        Header, mobile menu, footer, age gate, and cookie text. The signed-in account menu stays fixed so login and logout keep working.
      </p>
      <SiteContentForm part="menus" initial={readContent(site?.homepage)} categories={[]} cities={[]} />
    </AdminShell>
  );
}
