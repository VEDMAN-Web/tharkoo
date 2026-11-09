import Link from "next/link";
import { getBlogPosts } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Blog" };

export default async function Blog() {
  const posts = await getBlogPosts();
  return (
    <>
      <h1 className="text-[26px] font-normal">Blog</h1>
      <p className="mt-2 text-[13px] text-[#555]">Posts are edited in Admin → Blog editor.</p>
      <ul className="mt-4 grid gap-4">
        {posts.map((p) => (
          <li key={p.slug} className="bg-white p-4">
            <p className="text-[12px] text-[#888]">{p.date}</p>
            <Link href={`/blog/${p.slug}/`} className="text-[18px] font-bold text-[#222]">
              {p.title}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
