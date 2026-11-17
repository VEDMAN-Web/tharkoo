import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

/** The Listing pages screen now lives in the Listing pages tab of the Page builder; the old address leads there, keeping the chosen category or address. */
export default async function ListingPagesRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = new URLSearchParams({ tab: "listing" });
  if (one(params.kind) === "category" && /^[a-z0-9-]{1,80}$/.test(one(params.category))) next.set("category", one(params.category));
  if (one(params.kind) === "url" && one(params.url).startsWith("/")) next.set("url", one(params.url).slice(0, 300));
  redirect(`/admin/page-builder/?${next.toString()}`);
}
