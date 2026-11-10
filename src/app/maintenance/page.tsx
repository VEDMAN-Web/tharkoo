import { EmptyState } from "@/components/ui/EmptyState";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Maintenance | Tharkoo",
  description: "Tharkoo is briefly unavailable while we update the site.",
  path: "/maintenance/",
  index: false,
});

export default function Maintenance() {
  return <EmptyState heading="h1" title="We will be right back" body="Tharkoo is updating. Please try again shortly." action={{ href: "/", label: "Back to home" }} />;
}
