import { getCategories } from "@/lib/queries";
import { canonical } from "@/lib/seo";
import { shardEntries } from "@/lib/seo/sitemaps";
import { categoriesPath, citiesPath, DEFAULT_PATHS, safetyPath } from "@/lib/urls";
import { getPaths } from "@/server/urls/service";
import { getSeoSettings } from "@/app/admin/seo/settings/store";
import { DEFAULT_SEO_SETTINGS, llmsExtra } from "@/app/admin/seo/settings/rules";

export const revalidate = 300;

const DEFAULT_SUMMARY =
  "Tharkoo is a free classifieds site for India. People post local ads in Spa & Salon, Meetups and the LGBTQ+ Community, city by city. Contact details stay on each ad, and boosted ads can take paid video calls inside Tharkoo.";

const titleCase = (slug: string) => slug.split("-").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");

/** H22.1: the city-and-category pages that are in the sitemap, named for people ("Spa & Salon in Surat"). */
async function indexedListPages(names: Map<string, string>) {
  const entries = await shardEntries("cities").catch(() => []);
  const lines: string[] = [];
  for (const entry of entries) {
    const parts = new URL(entry.loc).pathname.split("/").filter(Boolean);
    if (parts.length !== 2) continue;
    const [first, city] = parts as [string, string];
    const label = first === "cities" ? `All ads in ${titleCase(city)}` : `${names.get(first) ?? titleCase(first)} in ${titleCase(city)}`;
    lines.push(`- [${label}](${entry.loc})`);
  }
  return lines;
}

export async function GET() {
  let categories: { slug?: string; name?: string }[] = [];
  let cities = citiesPath(DEFAULT_PATHS);
  try {
    const paths = await getPaths();
    cities = citiesPath(paths);
    categories = await getCategories();
  } catch {
    categories = [];
  }
  const names = new Map(categories.filter((cat) => cat.slug).map((cat) => [cat.slug as string, cat.name || titleCase(cat.slug as string)]));
  const listPages = await indexedListPages(names);
  const extra = llmsExtra(await getSeoSettings().catch(() => DEFAULT_SEO_SETTINGS));
  const lines = [
    "# Tharkoo",
    "",
    `> ${extra.intro ?? DEFAULT_SUMMARY}`,
    "",
    "Every page listed here is public. Ads are posted by people, not by Tharkoo. Account pages, search results and the admin tools are private and are not part of this guide.",
    "",
    "## Main pages",
    `- [Home](${canonical("/")}): latest and boosted ads across India`,
    `- [All categories](${canonical(categoriesPath())}): every category with its ads`,
    `- [All cities](${canonical(cities)}): ads by city`,
    `- [How it works](${canonical("/how-it-works/")}): posting, boosting and contacting people`,
    `- [Safety](${canonical(safetyPath())}): how to stay safe when you reply to or meet someone`,
    "",
    "## Categories",
    ...categories.filter((cat) => cat.slug).map((cat) => `- [${names.get(cat.slug as string)}](${canonical(`/${cat.slug}/`)})`),
    ...(listPages.length ? ["", "## City pages", ...listPages] : []),
    "",
    "## Help",
    `- [Posting an ad](${canonical("/help/post-ad/")})`,
    `- [Photos](${canonical("/help/photos/")})`,
    `- [Credits](${canonical("/help/credits/")})`,
    `- [TOP and Super Top](${canonical("/help/promotions/")})`,
    `- [ID verification](${canonical("/help/verification/")})`,
    `- [Avoiding scams](${canonical("/help/scams/")})`,
    `- [Contact](${canonical("/contact/")})`,
    ...extra.sections,
    "",
    "## Optional",
    `- [Blog](${canonical("/blog/")})`,
    `- [Prohibited items](${canonical("/prohibited-items/")})`,
    `- [Terms](${canonical("/terms/")})`,
    `- [Privacy](${canonical("/privacy/")})`,
    `- [Longer guide for AI tools](${canonical("/llms-full.txt")})`,
  ];
  return new Response(lines.join("\n") + "\n", { headers: { "content-type": "text/plain; charset=utf-8" } });
}
