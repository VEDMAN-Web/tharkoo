import { AdminShell } from "@/components/admin/AdminShell";
import { pageMetadata } from "@/lib/ui/meta";
import { Demo } from "./Demo";

export const metadata = pageMetadata({
  title: "Admin components | Tharkoo",
  description: "Admin UI kit samples.",
  path: "/styleguide/admin/",
  index: false,
  follow: false,
});

export default function AdminStyleguide() {
  return (
    <AdminShell title="Admin components">
      <Demo />
    </AdminShell>
  );
}
