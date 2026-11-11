import { AdminShell } from "@/components/admin/AdminShell";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { listLocations } from "@/server/locations/service";
import { loadListingOrder } from "@/server/ranking/admin";
import { publicCategories } from "@/server/search";
import { ListingOrderEditor } from "./ListingOrderEditor";

export const dynamic = "force-dynamic";

export default async function ListingOrderPage() {
  const identity = await getStaffFromHeaders();
  if (!identity.roles.some((role) => role === "admin" || role === "superadmin")) {
    return (
      <AdminShell title="Listing order">
        <p>Only an admin can change the listing order.</p>
      </AdminShell>
    );
  }
  const [state, categories, cities] = await Promise.all([
    loadListingOrder({ roles: identity.roles, email: identity.email }),
    publicCategories(),
    listLocations({ type: "city" }),
  ]);
  return (
    <AdminShell title="Listing order">
      <p className="mb-4 t-small text-muted">
        Choose how ads are ordered on the home page and on listing pages. Pins and hidden ads apply straight away; the tier order applies when you press Publish.
      </p>
      <ListingOrderEditor
        initial={state}
        categories={categories.map((category) => ({ slug: category.slug, name: category.name }))}
        cities={cities.map((city) => ({ slug: city.slug, name: city.name }))}
      />
    </AdminShell>
  );
}
