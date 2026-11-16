import { canonical } from "@/lib/seo";
import { websiteNode } from "@/lib/seo/schema";

type Node = Record<string, unknown>;

const DESCRIPTION_MAX = 155;

/** The Organization and WebSite nodes of the home page. The page's single WebPage node comes from the site chrome. */
export function homeSiteNodes(organization: Node, siteName: string, searchPath: string): Node[] {
  return [organization, websiteNode(siteName, searchPath)];
}

function cutAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max + 1);
  const space = head.lastIndexOf(" ");
  return (space > 0 ? head.slice(0, space) : text.slice(0, max)).replace(/[\s,;:-]+$/, "");
}

export function blogDescription(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  const sentences = flat.split(/(?<=[.!?])\s+/).filter(Boolean);
  let out = "";
  for (const sentence of sentences) {
    const next = out ? `${out} ${sentence}` : sentence;
    if (next.length > DESCRIPTION_MAX) break;
    out = next;
  }
  return out || cutAtWord(flat, DESCRIPTION_MAX);
}

function timeOf(date: string | undefined): number {
  const value = Date.parse(date || "");
  return Number.isNaN(value) ? 0 : value;
}

export function newestFirst<T extends { date?: string }>(posts: readonly T[]): T[] {
  return [...posts].sort((a, b) => timeOf(b.date) - timeOf(a.date));
}

export function blogIndexJsonLd(input: { name: string; path: string; posts: { title: string; path: string }[] }): Node[] {
  const url = canonical(input.path);
  return [
    { "@context": "https://schema.org", "@type": "Blog", name: input.name, url },
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: input.name,
      url,
      mainEntity: {
        "@type": "ItemList",
        itemListElement: input.posts.map((post, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: post.title,
          url: canonical(post.path),
        })),
      },
    },
  ];
}
