import { notFound } from "next/navigation";
import { StaticPage } from "@/components/StaticPage";
import { getPage } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function CmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();
  return (
    <StaticPage title={page.title || slug}>
      <div className="whitespace-pre-wrap">{page.body}</div>
    </StaticPage>
  );
}
