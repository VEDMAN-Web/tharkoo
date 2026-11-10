import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getHelp } from "@/lib/queries";
import { Container } from "@/components/ui/Container";
import { Prose } from "@/components/ui/Prose";
import { pageMetadata } from "@/lib/ui/meta";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getHelp(slug);
  if (!article) return {};
  return pageMetadata({
    title: `${article.title} | Tharkoo help`,
    description: (article.body || article.title || "").slice(0, 160),
    path: `/help/${slug}/`,
  });
}

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getHelp(slug);
  if (!article) notFound();
  return (
    <Container className="py-8">
      <p className="t-small">
        <Link href="/help/" className="text-gold">Help centre</Link>
      </p>
      <h1 className="t-h1 mt-2">{article.title}</h1>
      <Prose className="mt-4 whitespace-pre-wrap">{article.body}</Prose>
    </Container>
  );
}
