import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

const FILTERS = [
  { label: "Active", field: "status", value: "active" },
  { label: "Pending", field: "status", value: "pending" },
  { label: "Failed", field: "status", value: "failed" },
];

export default function Page() {
  return (
    <AdminShell title="Promotions">
      <p className="mb-3 t-small text-muted">Promotion orders. Product prices stay on the products screen.</p>
      <CollectionEditor
        model="PromotionOrder"
        title="Promotion orders"
        filters={FILTERS}
        allowCreate={false}
        summaryFields={["status", "durationDays"]}
      />
    </AdminShell>
  );
}
