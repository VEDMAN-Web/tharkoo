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
    <div className="adm-content">
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>Admin components</h1>
      <Demo />
    </div>
  );
}
