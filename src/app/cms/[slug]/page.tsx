import type { Metadata } from "next";
import { StaticPage } from "@/components/StaticPage";
import { EmptyState } from "@/components/ui/EmptyState";
import { getPage } from "@/lib/queries";
import { pageMetadata } from "@/lib/ui/meta";

export const revalidate = 300;

function labelOf(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  const title = page?.title || labelOf(slug);
  return pageMetadata({
    title: `${title} | Tharkoo`,
    description: (page?.body || page?.title || `${title} on Tharkoo.`).slice(0, 160),
    path: `/cms/${slug}/`,
  });
}

export default async function CmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) {
    return (
      <StaticPage title={labelOf(slug)}>
        <EmptyState
          title="This page is not published yet"
          body="The editorial team has not published this page. The help centre is available in the meantime."
          action={{ href: "/help/", label: "Open the help centre" }}
        />
      </StaticPage>
    );
  }
  return (
    <StaticPage title={page.title || labelOf(slug)}>
      <div className="whitespace-pre-wrap">{page.body}</div>
    </StaticPage>
  );
}
