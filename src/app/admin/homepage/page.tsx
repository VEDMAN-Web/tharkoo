import { AdminShell } from "@/components/admin/AdminShell";
import { SiteContentForm } from "@/components/admin/SiteContentForm";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { getCategories, getCities } from "@/lib/queries";
import { isAdminRole, readContent } from "@/lib/ui/site-content";
import { ensureHomepageDocument } from "@/lib/ui/site-store";
import { Site } from "@/server/models";

export const dynamic = "force-dynamic";

export default async function HomepageAdminPage() {
  const identity = await getStaffFromHeaders();
  if (!isAdminRole(identity.roles)) {
    return (
      <AdminShell title="Homepage">
        <p>Only an admin can edit the homepage.</p>
      </AdminShell>
    );
  }
  await ensureHomepageDocument();
  await connectDb();
  const [site, categories, cities] = await Promise.all([
    Site.findOne({ key: "default" }).lean(),
    getCategories(),
    getCities(),
  ]);
  return (
    <AdminShell title="Homepage">
      <p className="mb-4 t-small text-muted">
        Change the home page text, photos, category cards, and city rows. Save, then open the home page. Reset puts the original wording back.
      </p>
      <SiteContentForm
        part="home"
        initial={readContent(site?.homepage)}
        categories={categories.map((cat) => ({ slug: cat.slug || "", name: cat.name || "" }))}
        cities={cities.map((city) => ({ slug: city.slug || "", name: city.name || "" }))}
      />
    </AdminShell>
  );
}
