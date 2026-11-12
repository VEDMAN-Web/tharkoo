import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";
import { NotFoundBeacon } from "@/app/admin/urls/NotFoundBeacon";

export const metadata: Metadata = {
  title: "Page not found | Tharkoo",
  description: "That page is not on Tharkoo. Go back to the home page and choose a category.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <>
      <NotFoundBeacon />
      <EmptyState
        heading="h1"
        title="Page not found"
        body="That page is not on Tharkoo. Head home and pick a category."
        action={{ href: "/", label: "Back to home" }}
      />
    </>
  );
}
