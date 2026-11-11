import Link from "next/link";
import { getHelpArticles } from "@/lib/queries";
import { Container } from "@/components/ui/Container";
import { helpPath } from "@/lib/urls";
import { withUrlSeo } from "@/lib/seo/override";
import { getPaths } from "@/server/urls/service";

export const revalidate = 300;

export async function generateMetadata() {
  const paths = await getPaths();
  return withUrlSeo(helpPath(paths), {
    title: "Help Center: posting, accounts and contacting people | Tharkoo",
    description: "Guides for posting an ad, managing your account, and contacting someone on Tharkoo.",
    path: helpPath(paths),
  });
}

export default async function Help() {
  const [articles, paths] = await Promise.all([getHelpArticles(), getPaths()]);
  return (
    <Container className="py-8">
      <h1 className="t-h1">Help Center</h1>
      <ul className="mt-6 grid gap-3">
        {articles.map((article) => (
          <li key={article.slug}>
            <Link href={helpPath(paths, article.slug)} prefetch={false} className="t-body text-accent">
              {article.title}
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
