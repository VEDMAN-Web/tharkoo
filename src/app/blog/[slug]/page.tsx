import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlog } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlog(slug);
  if (!post) notFound();
  return (
    <article>
      <p className="text-[12px]">
        <Link href="/blog/">Blog</Link> · {post.date} · {post.author}
      </p>
      <h1 className="mt-2 text-[26px] font-normal">{post.title}</h1>
      <p className="mt-4 max-w-2xl whitespace-pre-wrap text-[14px] leading-6">{post.body}</p>
    </article>
  );
}
