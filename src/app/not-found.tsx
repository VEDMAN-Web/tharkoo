import type { Metadata } from "next";
import { headers } from "next/headers";
import { EmptyState } from "@/components/ui/EmptyState";
import { logNotFound } from "@/server/seo/notfound-log";

export const metadata: Metadata = {
  title: "Page not found | Tharkoo",
  description: "That page is not on Tharkoo. Go back to the home page and choose a category.",
  robots: { index: false, follow: false },
};

export default async function NotFound() {
  const seen = await headers();
  await logNotFound({ path: seen.get("x-pathname") ?? "", userAgent: seen.get("user-agent"), referer: seen.get("referer") });
  return (
    <EmptyState
      heading="h1"
      title="Page not found"
      body="That page is not on Tharkoo. Head home and pick a category."
      action={{ href: "/", label: "Back to home" }}
    />
  );
}
