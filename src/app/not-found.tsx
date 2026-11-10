import { EmptyState } from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <EmptyState
      heading="h1"
      title="Page not found"
      body="That page is not on Tharkoo. Head home and pick a category."
      action={{ href: "/", label: "Back to home" }}
    />
  );
}
