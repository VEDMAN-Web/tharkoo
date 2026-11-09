import Link from "next/link";
import { getHelpArticles } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Help centre" };

export default async function Help() {
  const articles = await getHelpArticles();
  return (
    <>
      <h1 className="text-[26px] font-normal">Help centre</h1>
      <p className="mt-2 text-[13px] text-[#555]">Articles are edited in Admin → Help editor.</p>
      <ul className="mt-4 grid gap-2">
        {articles.map((a) => (
          <li key={a.slug}>
            <Link href={`/help/${a.slug}/`}>{a.title}</Link>
          </li>
        ))}
      </ul>
    </>
  );
}
