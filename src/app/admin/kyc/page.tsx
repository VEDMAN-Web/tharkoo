import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <AdminShell title="KYC queue">
      <p className="mb-3 text-[13px] text-[#555]">Toggle verified on a listing to mark ID verified.</p>
      <CollectionEditor model="Listing" title="KYC queue" />
    </AdminShell>
  );
}
