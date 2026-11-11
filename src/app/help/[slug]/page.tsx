import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getHelp } from "@/lib/queries";
import { Container } from "@/components/ui/Container";
import { Prose } from "@/components/ui/Prose";
import { helpPath } from "@/lib/urls";
import { withUrlSeo, urlHeading } from "@/lib/seo/override";
import { getPaths } from "@/server/urls/service";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getHelp(slug);
  if (!article) return {};
  const paths = await getPaths();
  const path = helpPath(paths, article.slug || slug);
  return withUrlSeo(path, {
    title: `${article.title} | Tharkoo help`,
    description: (article.body || article.title || "").slice(0, 160),
    path,
  });
}

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [article, paths] = await Promise.all([getHelp(slug), getPaths()]);
  if (!article) notFound();
  const heading = await urlHeading(helpPath(paths, article.slug || slug), article.title || "Help");
  return (
    <Container className="py-8">
      <p className="t-small">
        <Link href={helpPath(paths)} className="text-accent">Help Center</Link>
      </p>
      <h1 className="t-h1 mt-2">{heading}</h1>
      <Prose className="mt-4 whitespace-pre-wrap">{article.body}</Prose>
    </Container>
  );
}
