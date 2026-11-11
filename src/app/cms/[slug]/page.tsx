import type { Metadata } from "next";
import { StaticPage } from "@/components/StaticPage";
import { EmptyState } from "@/components/ui/EmptyState";
import { JsonLd } from "@/lib/jsonld";
import { getPage } from "@/lib/queries";
import { aboutPageNode } from "@/lib/seo/schema";
import { cmsPath, helpPath } from "@/lib/urls";
import { withUrlSeo, urlHeading } from "@/lib/seo/override";
import { getPaths } from "@/server/urls/service";

export const revalidate = 300;

function labelOf(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  const title = page?.title || labelOf(slug);
  const paths = await getPaths();
  const path = cmsPath(paths, page?.slug || slug);
  const brandTitle = /\|\s*Tharkoo$/.test(title) ? title : `${title} | Tharkoo`;
  const seoTitle = brandTitle.length < 30 ? `${title}: official page | Tharkoo` : brandTitle;
  const plain = (page?.body || "").replace(/<[^>]+>/g, " ").replace(/[#*_>\[\]()`]/g, " ").replace(/\s+/g, " ").trim();
  const clipped = plain.length > 160 ? `${plain.slice(0, 157).replace(/\s+\S*$/, "")}…` : plain;
  const seoDescription = clipped.length >= 70 ? clipped : `${title} on Tharkoo. Read the full page for details about free classifieds across India.`;
  return withUrlSeo(path, {
    title: seoTitle,
    description: seoDescription,
    path,
  });
}

export default async function CmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [page, paths] = await Promise.all([getPage(slug), getPaths()]);
  const heading = await urlHeading(cmsPath(paths, page?.slug || slug), page?.title || labelOf(slug));
  if (!page) {
    return (
      <StaticPage title={heading}>
        <EmptyState
          title="This page is not published yet"
          body="The editorial team has not published this page. The help centre is available in the meantime."
          action={{ href: helpPath(paths), label: "Open the help centre" }}
        />
      </StaticPage>
    );
  }
  return (
    <StaticPage title={heading}>
      {page.slug === "about" ? <JsonLd data={aboutPageNode(page.title || "About", cmsPath(paths, "about"))} /> : null}
      <div className="whitespace-pre-wrap">{page.body}</div>
    </StaticPage>
  );
}
