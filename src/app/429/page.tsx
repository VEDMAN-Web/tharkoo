import { EmptyState } from "@/components/ui/EmptyState";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Easy there | Tharkoo",
  description: "Too many requests in a short time. Wait a moment and try again.",
  path: "/429/",
  index: false,
});

export default function TooMany() {
  return (
    <EmptyState
      heading="h1"
      title="Easy there"
      body="Too many requests in a short time. Wait a moment, then head home."
      action={{ href: "/", label: "Back to home" }}
    />
  );
}
