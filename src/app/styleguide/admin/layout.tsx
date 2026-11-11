import { AdminViewerProvider } from "@/components/admin/AdminShell";
import "@/styles/admin.css";

/** The admin style guide uses the admin frame (AdminShell in the page) with a sample viewer who sees every menu item. */
export default function AdminStyleguideLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminViewerProvider name="Style guide" roles={["superadmin"]}>
      {children}
    </AdminViewerProvider>
  );
}
