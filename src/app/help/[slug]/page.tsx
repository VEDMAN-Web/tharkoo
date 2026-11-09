import Link from "next/link";
import { notFound } from "next/navigation";
import { getHelp } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getHelp(slug);
  if (!article) notFound();
  return (
    <article>
      <p className="text-[12px]">
        <Link href="/help/">Help centre</Link>
      </p>
      <h1 className="mt-2 text-[26px] font-normal">{article.title}</h1>
      <p className="mt-4 max-w-2xl whitespace-pre-wrap text-[14px] leading-6">{article.body}</p>
    </article>
  );
}
