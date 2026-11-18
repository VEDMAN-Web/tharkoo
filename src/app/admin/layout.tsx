import { getStaffFromHeaders, isStaff } from "@/lib/admin-auth";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { AdminViewerProvider } from "@/components/admin/AdminShell";
import { MockPaymentsBanner } from "@/components/admin/MockPaymentsBanner";
import { RowFlash } from "@/components/admin/RowFlash";
import { pageMetadata } from "@/lib/ui/meta";
import { getAdminCounts } from "@/server/admin/counts";
import "@/styles/admin.css";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Staff | Tharkoo",
  description: "Staff tools for Tharkoo.",
  path: "/admin/",
  index: false,
  follow: false,
});

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const identity = await getStaffFromHeaders();
  if (!isStaff(identity)) return <AdminLoginForm />;
  const counts = await getAdminCounts(identity.roles).catch(() => ({}));
  return (
    <AdminViewerProvider name={identity.name} roles={identity.roles} counts={counts} banner={<MockPaymentsBanner />}>
      {children}
      <RowFlash />
    </AdminViewerProvider>
  );
}
