import { AdminShell } from "@/components/admin/AdminShell";
import { LocationsManager } from "./LocationsManager";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="Locations">
      <p className="mb-3 t-small text-muted">
        Add, edit, hide or remove countries, states and cities. The flag comes from the two-letter country code. The footer and the All countries page only show places with live ads.
      </p>
      <LocationsManager />
    </AdminShell>
  );
}
