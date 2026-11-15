import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";
import { NotFoundBeacon } from "@/app/admin/urls/NotFoundBeacon";
import { NotFoundView } from "@/components/new/NotFoundView";
import { getCategories } from "@/lib/queries";
import { defaultNewDesign, newDesignOn } from "@/server/site-links/new-design";

export const metadata: Metadata = {
  title: "Page not found | Tharkoo",
  description: "That page is not on Tharkoo. Go back to the home page and choose a category.",
  robots: { index: false, follow: false },
};

export default async function NotFound() {
  const newDesign = await newDesignOn().catch(() => defaultNewDesign());
  if (newDesign) {
    const categories = await getCategories()
      .then((list) =>
        list
          .filter((category) => category.slug && category.name)
          .slice(0, 5)
          .map((category) => ({ slug: category.slug || "", name: category.name || "" })),
      )
      .catch(() => []);
    return (
      <>
        <NotFoundBeacon />
        <NotFoundView categories={categories} />
      </>
    );
  }
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
