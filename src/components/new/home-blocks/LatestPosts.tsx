import Link from "next/link";
import { SectionHead } from "./SectionHead";
import type { HomePost } from "./types";

export function HomeLatestPosts({ title, posts }: { title: string; posts: HomePost[] }) {
  if (!posts.length) return null;
  return (
    <section className="tkh-page tkh-section" aria-labelledby="home-posts">
      <SectionHead id="home-posts" eyebrow="" tone="peach" title={title} />
      <ul className="tkh-posts">
        {posts.map((post) => (
          <li key={post.href}>
            <Link href={post.href} prefetch={false}>
              {post.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
