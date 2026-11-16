import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { isAdminRole } from "@/lib/ui/site-content";
import { KitGallery } from "./KitGallery";

export const dynamic = "force-dynamic";

/** H8.2 (A2): the admin kit gallery. Admin roles only; other staff get the normal not-found page. */
export default async function Page() {
  const identity = await getStaffFromHeaders();
  if (!isAdminRole([...identity.roles])) notFound();
  return (
    <AdminShell title="Admin kit">
      <KitGallery />
    </AdminShell>
  );
}
