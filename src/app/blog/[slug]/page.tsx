import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { JsonLd } from "@/lib/jsonld";
import { getBlog } from "@/lib/queries";
import { canonical } from "@/lib/seo";
import { blogPostingNode } from "@/lib/seo/schema";
import { Container } from "@/components/ui/Container";
import { Prose } from "@/components/ui/Prose";
import { LegalView } from "@/components/new/LegalView";
import { bodyParagraphs, readingMinutes, toSections } from "@/components/new/legal-copy";
import { blogPath, contactPath } from "@/lib/urls";
import { blogCoverOf } from "@/data/help";
import { withUrlSeo, urlHeading } from "@/lib/seo/override";
import { getPaths } from "@/server/urls/service";
import { newDesignOn } from "@/server/site-links/new-design";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlog(slug);
  if (!post) return {};
  const paths = await getPaths();
  const path = blogPath(paths, post.slug || slug);
  const postTitle = post.title || "Blog";
  const brandTitle = /\|\s*Tharkoo$/.test(postTitle) ? postTitle : `${postTitle} | Tharkoo`;
  const seoTitle = brandTitle.length < 30 ? `Blog: ${brandTitle}` : brandTitle;
  const body = post.body || "";
  const seoDescription = body.length >= 70 ? body : `${postTitle} on the Tharkoo blog. Read the full article for practical tips on posting and staying safe.`;
  return withUrlSeo(path, {
    title: seoTitle,
    description: seoDescription.slice(0, 160),
    path,
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [post, paths, newDesign] = await Promise.all([getBlog(slug), getPaths(), newDesignOn()]);
  if (!post) notFound();
  const path = blogPath(paths, post.slug || slug);
  const heading = await urlHeading(path, post.title || "Blog");
  const jsonLd = (
    <JsonLd
      data={blogPostingNode({
        headline: heading,
        datePublished: post.date,
        dateModified: post.date,
        author: post.author,
        url: canonical(path),
      })}
    />
  );
  if (newDesign) {
    const paragraphs = bodyParagraphs(post.body);
    return (
      <>
        {jsonLd}
        <LegalView
          crumbs={[{ label: "Tharkoo India", href: "/" }, { label: "Blog", href: blogPath(paths) }, { label: heading }]}
          title={heading}
          updated={post.date || ""}
          updatedPrefix="Published"
          minutes={readingMinutes(paragraphs)}
          author={post.author || undefined}
          cover={blogCoverOf(post.slug || slug)}
          sections={toSections(paragraphs, slug)}
          askHref={contactPath(paths)}
          askLabel="Questions about this article?"
        />
      </>
    );
  }
  return (
    <Container className="py-8">
      {jsonLd}
      <p className="t-small">
        <Link href={blogPath(paths)} className="text-accent">Tharkoo Blog</Link> · {post.date} · {post.author}
      </p>
      <h1 className="t-h1 mt-2">{heading}</h1>
      <Prose className="mt-4 whitespace-pre-wrap">{post.body}</Prose>
    </Container>
  );
}
