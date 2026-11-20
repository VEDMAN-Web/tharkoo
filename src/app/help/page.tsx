import { getHelpArticles } from "@/lib/queries";
import { helpPath } from "@/lib/urls";
import { withUrlSeo } from "@/lib/seo/override";
import { getPaths } from "@/server/urls/service";
import { readShellConfig } from "@/server/site-links/shell-config";
import { HelpView, type HelpCard, type HelpRow } from "@/components/h714/HelpView";

export const revalidate = 300;

const QUICK_TOPICS = ["Edit my ad", "Log-in code", "Credits back", "Report an ad"];
const POPULAR_COUNT = 5;
/** With no sections the hub shows one tile for each article, up to this many. */
const TILE_MAX = 12;
const TILE_TEXT_MAX = 90;

/** The first sentence of a body, plain text, short enough for a tile. */
function excerptOf(body: string | undefined) {
  const plain = (body || "").replace(/[#*_`>\[\]()]/g, " ").replace(/\s+/g, " ").trim();
  const sentence = plain.split(/(?<=[.!?])\s/)[0] ?? "";
  return sentence.length <= TILE_TEXT_MAX ? sentence : `${sentence.slice(0, TILE_TEXT_MAX - 1).replace(/\s+\S*$/, "")}...`;
}

export async function generateMetadata() {
  const paths = await getPaths();
  return withUrlSeo(helpPath(paths), {
    title: "Help Center: posting, accounts and contacting people | Tharkoo",
    description: "Guides for posting an ad, managing your account, and contacting someone on Tharkoo.",
    path: helpPath(paths),
  });
}

function pluralArticles(count: number) {
  return `${count} ${count === 1 ? "article" : "articles"}`;
}

export default async function Help({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = (q || "").trim().slice(0, 100);
  const [articles, paths, shell] = await Promise.all([getHelpArticles(), getPaths(), readShellConfig()]);
  const helpRoot = helpPath(paths);
  const link = (slug?: string) => helpPath(paths, slug || "");

  const sections = new Map<string, { first: string; count: number }>();
  for (const article of articles) {
    const name = (article.section || "").trim();
    if (!name) continue;
    const seen = sections.get(name);
    if (seen) seen.count += 1;
    else sections.set(name, { first: article.slug || "", count: 1 });
  }
  // H17.7: every tile opens a real article (never the hub itself), and every number is a real count.
  const cards: HelpCard[] = sections.size
    ? [...sections].map(([title, value]) => ({ title, desc: "", count: pluralArticles(value.count), href: link(value.first) }))
    : articles.slice(0, TILE_MAX).map((article) => ({ title: article.title || "", desc: excerptOf(article.body), count: "Read the guide", href: link(article.slug) }));

  let popular: HelpRow[];
  let popularHeading = "Popular articles";
  if (query) {
    const needle = query.toLowerCase();
    const matches = articles.filter((article) => `${article.title || ""} ${article.section || ""}`.toLowerCase().includes(needle));
    popular = matches.slice(0, 10).map((article) => ({ title: article.title || "", href: link(article.slug) }));
    popularHeading = matches.length ? `Results for "${query}"` : `No articles match "${query}"`;
  } else {
    popular = articles.slice(0, POPULAR_COUNT).map((article) => ({ title: article.title || "", href: link(article.slug) }));
  }

  return (
    <HelpView
      cards={cards}
      popular={popular}
      total={articles.length}
      popularHeading={popularHeading}
      quickTopics={QUICK_TOPICS.map((label) => ({ label, href: `${helpRoot}?q=${encodeURIComponent(label)}` }))}
      query={query}
      helpHref={helpRoot}
      chatHref="/contact/"
      whatsappHref={shell.chat.whatsapp}
      telegramHref={shell.chat.telegram}
      contactHref="/contact/"
    />
  );
}
