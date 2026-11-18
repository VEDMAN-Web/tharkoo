import { stripDevNotes } from "@/components/new/legal-copy";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getHelp, getHelpArticles } from "@/lib/queries";
import { helpPath } from "@/lib/urls";
import { withUrlSeo, urlHeading } from "@/lib/seo/override";
import { getPaths } from "@/server/urls/service";
import { HelpArticleView } from "@/components/h714/HelpArticleView";
import { PriceCard } from "@/components/recharge/PriceCard";
import { readPriceList } from "@/server/billing/price-list";

export const revalidate = 300;

const WORDS_PER_MINUTE = 200;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getHelp(slug);
  if (!article) return {};
  const paths = await getPaths();
  const path = helpPath(paths, article.slug || slug);
  const articleTitle = article.title || "Help";
  const plainTitle = articleTitle.replace(/\s*\|\s*Tharkoo$/, "");
  const helpTitle = `Help: ${plainTitle} | Tharkoo`;
  const seoTitle = helpTitle.length < 30 ? `Help: ${plainTitle} guide | Tharkoo` : helpTitle;
  const plain = stripDevNotes(article.body || "").replace(/<[^>]+>/g, " ").replace(/[#*_>\[\]()`]/g, " ").replace(/\s+/g, " ").trim();
  const clipped = plain.length > 160 ? `${plain.slice(0, 157).replace(/\s+\S*$/, "")}…` : plain;
  const seoDescription = clipped.length >= 70 ? clipped : `${articleTitle} on Tharkoo help. Read the full guide for step-by-step help with posting, your account and contacting people.`;
  return withUrlSeo(path, {
    title: seoTitle,
    description: seoDescription,
    path,
  });
}

function updatedLabel(date?: Date) {
  if (!date) return "";
  return `Updated ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(date))}`;
}

function readLabel(body: string) {
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  return `${Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))} min read`;
}

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [article, articles, paths] = await Promise.all([getHelp(slug), getHelpArticles(), getPaths()]);
  if (!article) notFound();
  const heading = await urlHeading(helpPath(paths, article.slug || slug), article.title || "Help");
  const section = (article.section || "").trim();
  const sameSection = section ? articles.filter((item) => (item.section || "").trim() === section) : [];
  const related = (sameSection.length ? sameSection : [article]).map((item) => ({
    title: item.title || "",
    href: helpPath(paths, item.slug || ""),
  }));
  return (
    <HelpArticleView
      helpRoot={helpPath(paths)}
      section={section || "Help"}
      title={heading}
      updatedLabel={updatedLabel(article.updatedAt)}
      readLabel={readLabel(stripDevNotes(article.body || ""))}
      related={related}
      body={stripDevNotes(article.body || "")}
      contactHref="/contact/"
      extra={(article.slug || slug) === "credits" ? <PriceCard data={await readPriceList()} /> : null}
    />
  );
}
