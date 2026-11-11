import { getStaffFromHeaders, isStaff } from "@/lib/admin-auth";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { AdminViewerProvider } from "@/components/admin/AdminShell";
import { pageMetadata } from "@/lib/ui/meta";
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
  return (
    <AdminViewerProvider name={identity.name} roles={identity.roles}>
      {children}
    </AdminViewerProvider>
  );
}
