import { AdminShell } from "@/components/admin/AdminShell";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { VideoTourSettings } from "./VideoTourSettings";

export const dynamic = "force-dynamic";

export default async function VideoToursPage() {
  const identity = await getStaffFromHeaders();
  if (!identity.roles.includes("superadmin")) {
    return (
      <AdminShell title="Video tours">
        <p>Only a superadmin can change video tour settings.</p>
      </AdminShell>
    );
  }
  return (
    <AdminShell title="Video tours">
      <p className="mb-3 t-small text-muted">
        Live video tours are paid in coins. Switch them on per category and set the coin price. Tours are never available for people listings.
      </p>
      <VideoTourSettings />
    </AdminShell>
  );
}
