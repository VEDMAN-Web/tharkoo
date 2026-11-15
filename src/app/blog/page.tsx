import Link from "next/link";
import { getBlogPosts } from "@/lib/queries";
import { Container } from "@/components/ui/Container";
import { BlogList } from "@/components/new/BlogView";
import { blogPath } from "@/lib/urls";
import { withUrlSeo } from "@/lib/seo/override";
import { getPaths } from "@/server/urls/service";
import { newDesignOn } from "@/server/site-links/new-design";

export const revalidate = 300;

export async function generateMetadata() {
  const paths = await getPaths();
  return withUrlSeo(blogPath(paths), {
    title: "Tharkoo Blog: tips for safe, clear classified ads | Tharkoo",
    description: "Notes from Tharkoo on using classifieds, staying safe when you meet someone, and posting a clear ad.",
    path: blogPath(paths),
  });
}

export default async function Blog() {
  const [posts, paths, newDesign] = await Promise.all([getBlogPosts(), getPaths(), newDesignOn()]);
  if (newDesign) {
    return (
      <BlogList
        posts={posts.map((post) => ({
          slug: post.slug || "",
          title: post.title || "Untitled",
          date: post.date || "",
          body: post.body || "",
          href: blogPath(paths, post.slug),
        }))}
      />
    );
  }
  return (
    <Container className="py-8">
      <h1 className="t-h1">Tharkoo Blog</h1>
      <ul className="mt-6 grid gap-4">
        {posts.map((post) => (
          <li key={post.slug} className="rounded-lg border border-line p-4">
            <p className="t-caption text-muted">{post.date}</p>
            <Link href={blogPath(paths, post.slug)} prefetch={false} className="t-h3 text-accent">
              {post.title}
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
