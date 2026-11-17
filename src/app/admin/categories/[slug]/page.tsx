import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** The fields editor now lives in the Form fields tab of Categories & fields; this address leads there. */
export default async function CategoryFieldsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) notFound();
  redirect(`/admin/categories/?c=${slug}&tab=fields`);
}
