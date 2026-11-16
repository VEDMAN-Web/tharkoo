import { getHelpArticles } from "@/lib/queries";
import { helpPath } from "@/lib/urls";
import { withUrlSeo } from "@/lib/seo/override";
import { getPaths } from "@/server/urls/service";
import { readShellConfig } from "@/server/site-links/shell-config";
import { SUPPORT_PHONE, SUPPORT_TELEGRAM, telegramHref, whatsappHref } from "@/lib/support";
import { HelpView, type HelpCard, type HelpRow } from "@/components/h714/HelpView";

export const revalidate = 300;

const PLACEHOLDER_CARDS = [
  ["Posting an ad", "Create, edit, renew and delete", "8 articles"],
  ["Log in and account", "Codes, profile, delete account", "6 articles"],
  ["Coins and payments", "Buy coins, refunds, invoices", "7 articles"],
  ["Video calls", "How calls work, coins back", "5 articles"],
  ["Safety and scams", "Spot fake ads, stay safe", "9 articles"],
  ["Photos and videos", "Sizes, watermark, rules", "5 articles"],
  ["Top and Featured", "Boost your ad", "4 articles"],
  ["Chats and messages", "Chat online, WhatsApp, block", "6 articles"],
];
const PLACEHOLDER_ROWS = [
  "How do I edit or delete my ad?",
  "I did not get my log-in code",
  "My video call failed. Do I get my coins back?",
  "Why was my ad not approved?",
  "How do I report a fake ad?",
];
const QUICK_TOPICS = ["Edit my ad", "Log-in code", "Coins back", "Report an ad"];
const POPULAR_COUNT = 5;

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
  const cards: HelpCard[] = sections.size
    ? [...sections].map(([title, value]) => ({ title, desc: "", count: pluralArticles(value.count), href: link(value.first) }))
    : PLACEHOLDER_CARDS.map(([title, desc, count]) => ({ title, desc, count, href: helpRoot }));

  let popular: HelpRow[];
  let popularHeading = "Popular articles";
  if (query) {
    const needle = query.toLowerCase();
    const matches = articles.filter((article) => `${article.title || ""} ${article.section || ""}`.toLowerCase().includes(needle));
    popular = matches.slice(0, 10).map((article) => ({ title: article.title || "", href: link(article.slug) }));
    popularHeading = matches.length ? `Results for "${query}"` : `No articles match "${query}"`;
  } else {
    popular = articles.length
      ? articles.slice(0, POPULAR_COUNT).map((article) => ({ title: article.title || "", href: link(article.slug) }))
      : PLACEHOLDER_ROWS.map((title) => ({ title, href: helpRoot }));
  }

  return (
    <HelpView
      cards={cards}
      popular={popular}
      popularHeading={popularHeading}
      quickTopics={QUICK_TOPICS.map((label) => ({ label, href: `${helpRoot}?q=${encodeURIComponent(label)}` }))}
      query={query}
      helpHref={helpRoot}
      chatHref="/contact/"
      whatsappHref={shell.chat.whatsapp || whatsappHref(SUPPORT_PHONE)}
      telegramHref={shell.chat.telegram || telegramHref(SUPPORT_TELEGRAM)}
      contactHref="/contact/"
    />
  );
}
