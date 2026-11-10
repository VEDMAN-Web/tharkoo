import { EmptyState } from "@/components/ui/EmptyState";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Listing removed | Tharkoo",
  description: "This listing is no longer available.",
  path: "/gone/",
  index: false,
});

export default function Gone() {
  return (
    <EmptyState
      heading="h1"
      title="This listing was removed"
      body="The ad is no longer available. Browse a category instead."
      action={{ href: "/", label: "Back to home" }}
    />
  );
}
