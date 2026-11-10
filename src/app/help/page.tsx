import Link from "next/link";
import { getHelpArticles } from "@/lib/queries";
import { Container } from "@/components/ui/Container";
import { pageMetadata } from "@/lib/ui/meta";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Help Center | Tharkoo",
  description: "Guides for using Tharkoo.",
  path: "/help/",
});

export default async function Help() {
  const articles = await getHelpArticles();
  return (
    <Container className="py-8">
      <h1 className="t-h1">Help Center</h1>
      <ul className="mt-6 grid gap-3">
        {articles.map((article) => (
          <li key={article.slug}>
            <Link href={`/help/${article.slug}/`} prefetch={false} className="t-body text-accent">
              {article.title}
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
