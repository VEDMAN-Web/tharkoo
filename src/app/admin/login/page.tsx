import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Staff sign in | Tharkoo",
  description: "Sign in to the Tharkoo staff area.",
  path: "/admin/login/",
  index: false,
});

export default function AdminLogin() {
  return <AdminLoginForm />;
}
