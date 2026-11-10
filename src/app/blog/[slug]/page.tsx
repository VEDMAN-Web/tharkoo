import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBlog } from "@/lib/queries";
import { Container } from "@/components/ui/Container";
import { Prose } from "@/components/ui/Prose";
import { pageMetadata } from "@/lib/ui/meta";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlog(slug);
  if (!post) return {};
  return pageMetadata({
    title: `${post.title} | Tharkoo`,
    description: (post.body || post.title || "").slice(0, 160),
    path: `/blog/${slug}/`,
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlog(slug);
  if (!post) notFound();
  return (
    <Container className="py-8">
      <p className="t-small">
        <Link href="/blog/" className="text-accent">Tharkoo Blog</Link> · {post.date} · {post.author}
      </p>
      <h1 className="t-h1 mt-2">{post.title}</h1>
      <Prose className="mt-4 whitespace-pre-wrap">{post.body}</Prose>
    </Container>
  );
}
