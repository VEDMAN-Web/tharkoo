import { AdminShell } from "@/components/admin/AdminShell";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { isAdminRole } from "@/lib/ui/site-content";
import { readMoneySettings } from "@/server/billing/money-settings";
import { MoneySettingsForm } from "./MoneySettingsForm";

export const dynamic = "force-dynamic";

export default async function MoneyPage() {
  const identity = await getStaffFromHeaders();
  if (!isAdminRole(identity.roles)) {
    return (
      <AdminShell title="Money">
        <p>Only an admin can change money settings.</p>
      </AdminShell>
    );
  }
  return (
    <AdminShell title="Money">
      <MoneySettingsForm initial={await readMoneySettings()} />
    </AdminShell>
  );
}
