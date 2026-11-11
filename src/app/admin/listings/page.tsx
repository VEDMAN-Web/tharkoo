import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

const FILTERS = [
  { label: "Active", field: "status", value: "active" },
  { label: "Pending", field: "status", value: "pending" },
  { label: "Paused", field: "status", value: "paused" },
  { label: "Rejected", field: "status", value: "rejected" },
  { label: "Draft", field: "status", value: "draft" },
];

export default function Page() {
  return (
    <AdminShell title="Listings">
      <p className="mb-3 t-small text-muted">Moderate listings. Filter by status, then open a row to edit it.</p>
      <CollectionEditor
        model="Listing"
        title="Listings"
        filters={FILTERS}
        summaryFields={["status", "title"]}
      />
    </AdminShell>
  );
}
