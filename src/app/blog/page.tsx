import Link from "next/link";
import { getBlogPosts } from "@/lib/queries";
import { Container } from "@/components/ui/Container";
import { pageMetadata } from "@/lib/ui/meta";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Tharkoo Blog | Tharkoo",
  description: "Notes from Tharkoo.",
  path: "/blog/",
});

export default async function Blog() {
  const posts = await getBlogPosts();
  return (
    <Container className="py-8">
      <h1 className="t-h1">Tharkoo Blog</h1>
      <ul className="mt-6 grid gap-4">
        {posts.map((post) => (
          <li key={post.slug} className="rounded-lg border border-line p-4">
            <p className="t-caption text-muted">{post.date}</p>
            <Link href={`/blog/${post.slug}/`} prefetch={false} className="t-h3 text-accent">
              {post.title}
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
