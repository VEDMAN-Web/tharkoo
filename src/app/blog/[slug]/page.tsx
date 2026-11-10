import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBlog } from "@/lib/queries";
import { Container } from "@/components/ui/Container";
import { Prose } from "@/components/ui/Prose";
import { blogPath } from "@/lib/urls";
import { withUrlSeo, urlHeading } from "@/lib/seo/override";
import { getPaths } from "@/server/urls/service";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlog(slug);
  if (!post) return {};
  const paths = await getPaths();
  const path = blogPath(paths, post.slug || slug);
  return withUrlSeo(path, {
    title: `${post.title} | Tharkoo`,
    description: (post.body || post.title || "").slice(0, 160),
    path,
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [post, paths] = await Promise.all([getBlog(slug), getPaths()]);
  if (!post) notFound();
  const path = blogPath(paths, post.slug || slug);
  const heading = await urlHeading(path, post.title || "Blog");
  return (
    <Container className="py-8">
      <p className="t-small">
        <Link href={blogPath(paths)} className="text-accent">Tharkoo Blog</Link> · {post.date} · {post.author}
      </p>
      <h1 className="t-h1 mt-2">{heading}</h1>
      <Prose className="mt-4 whitespace-pre-wrap">{post.body}</Prose>
    </Container>
  );
}
