import Link from "next/link";
import { getBlogPosts } from "@/lib/queries";
import { JsonLd } from "@/lib/jsonld";
import { blogIndexJsonLd } from "@/lib/seo/home-blog";
import { Container } from "@/components/ui/Container";
import { BlogList } from "@/components/new/BlogView";
import { coverOf } from "@/components/new/blog-cover-data";
import { blogPath } from "@/lib/urls";
import { withUrlSeo } from "@/lib/seo/override";
import { getPaths } from "@/server/urls/service";
import { newDesignOn } from "@/server/site-links/new-design";

export const revalidate = 300;

const PAGE_SIZE = 9;

export async function generateMetadata() {
  const paths = await getPaths();
  return withUrlSeo(blogPath(paths), {
    title: "Tharkoo Blog: tips for safe, clear classified ads | Tharkoo",
    description: "Notes from Tharkoo on using classifieds, staying safe when you meet someone, and posting a clear ad.",
    path: blogPath(paths),
  });
}

export default async function Blog({ searchParams }: { searchParams: Promise<{ category?: string; page?: string }> }) {
  const [{ category = "", page: pageParam = "1" }, posts, paths, newDesign] = await Promise.all([searchParams, getBlogPosts(), getPaths(), newDesignOn()]);
  if (newDesign) {
    const categories = [...new Set(posts.map((post) => post.category || "").filter(Boolean))];
    const matching = category ? posts.filter((post) => post.category === category) : posts;
    const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
    const page = Math.min(pages, Math.max(1, Number(pageParam) || 1));
    const visible = matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return (
      <>
      <JsonLd data={blogIndexJsonLd({ name: "Tharkoo Blog", path: blogPath(paths), posts: visible.map((post) => ({ title: post.title || "Untitled", path: blogPath(paths, post.slug) })) })} />
      <BlogList
        posts={visible.map((post) => ({
          slug: post.slug || "",
          title: post.title || "Untitled",
          date: post.date || "",
          body: post.body || "",
          category: post.category || "",
          cover: coverOf(post),
          href: blogPath(paths, post.slug),
        }))}
        categories={categories}
        active={category}
        page={page}
        pages={pages}
        basePath={blogPath(paths)}
      />
      </>
    );
  }
  return (
    <Container className="py-8">
      <JsonLd data={blogIndexJsonLd({ name: "Tharkoo Blog", path: blogPath(paths), posts: posts.map((post) => ({ title: post.title || "Untitled", path: blogPath(paths, post.slug) })) })} />
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
