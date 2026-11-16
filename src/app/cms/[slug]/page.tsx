import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { StaticPage } from "@/components/StaticPage";
import { LegalView } from "@/components/new/LegalView";
import { bodyParagraphs, publicParagraphs, readingMinutes, stripDevNotes, toSections } from "@/components/new/legal-copy";
import { JsonLd } from "@/lib/jsonld";
import { getPage } from "@/lib/queries";
import { aboutPageNode } from "@/lib/seo/schema";
import { cmsPath, contactPath } from "@/lib/urls";
import { withUrlSeo, urlHeading } from "@/lib/seo/override";
import { getPaths } from "@/server/urls/service";
import { newDesignOn } from "@/server/site-links/new-design";

export const revalidate = 300;

const UNPUBLISHED_TEXT = "The editorial team has not published this page yet. The help centre is available in the meantime.";

function labelOf(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function updatedLabel(date: Date | undefined) {
  if (!date) return "November 2026";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return {};
  const title = page.title || labelOf(slug);
  const paths = await getPaths();
  const path = cmsPath(paths, page.slug || slug);
  const brandTitle = /\|\s*Tharkoo$/.test(title) ? title : `${title} | Tharkoo`;
  const seoTitle = brandTitle.length < 30 ? `${title}: official page | Tharkoo` : brandTitle;
  const plain = stripDevNotes(page.body || "").replace(/<[^>]+>/g, " ").replace(/[#*_>\[\]()`]/g, " ").replace(/\s+/g, " ").trim();
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
  const [page, paths, newDesign] = await Promise.all([getPage(slug), getPaths(), newDesignOn()]);
  if (!page) notFound();
  const heading = await urlHeading(cmsPath(paths, page.slug || slug), page.title || labelOf(slug));
  const aboutData = page.slug === "about" ? <JsonLd data={aboutPageNode(page.title || "About", cmsPath(paths, "about"))} /> : null;
  if (newDesign) {
    const paragraphs = bodyParagraphs(page.body);
    const summary = paragraphs.find((paragraph) => paragraph.startsWith("In short:"));
    const body = paragraphs.filter((paragraph) => paragraph !== summary);
    const built = toSections(body, slug);
    const sections = built.length ? built : [{ id: "intro", paragraphs: [UNPUBLISHED_TEXT] }];
    return (
      <>
        {aboutData}
        <LegalView
          crumbs={[{ label: "Tharkoo India", href: "/" }, { label: heading }]}
          title={heading}
          updated={updatedLabel(page.updatedAt)}
          minutes={readingMinutes(paragraphs)}
          summary={summary?.replace(/^In short:\s*/, "")}
          sections={sections}
          askHref={contactPath(paths)}
          askLabel="Questions about this page?"
        />
      </>
    );
  }
  return (
    <StaticPage title={heading}>
      {aboutData}
      <div className="whitespace-pre-wrap">{publicParagraphs(bodyParagraphs(page.body), slug).join("\n\n")}</div>
    </StaticPage>
  );
}
