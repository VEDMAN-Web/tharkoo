import { expect, test } from "./helpers";

const PAGE_LIMIT = 50;
const SKIP = /^\/(admin|api|u|uploads|_next|brand|placeholders|sitemap|robots|manifest)(\/|$)|\.[a-z0-9]{2,5}$/i;
const OLD_AD = /^\/ad\/(?!video\/)/;

function internalLinks(html: string) {
  const found = new Set<string>();
  for (const match of html.matchAll(/<a\s[^>]*href="(\/[^"#?]*)"/gi)) {
    const path = match[1];
    if (!path.startsWith("//") && !SKIP.test(path)) found.add(path);
  }
  return found;
}

test.describe("H16.2 crawl of 50 pages", () => {
  test("every internal link on the first 50 pages opens, and no link still points at an old /ad/ address", async ({ request }) => {
    test.setTimeout(240_000);
    const queue = ["/", "/dating/", "/dating/bengaluru/", "/search/?q=a"];
    const visited = new Set<string>();
    const seen = new Set<string>();
    const broken: string[] = [];
    const oldLinks: string[] = [];

    while (queue.length && visited.size < PAGE_LIMIT) {
      const path = queue.shift() as string;
      if (visited.has(path)) continue;
      visited.add(path);
      const res = await request.get(path);
      if (res.status() >= 400) {
        broken.push(`${res.status()} ${path}`);
        continue;
      }
      for (const href of internalLinks(await res.text())) {
        if (OLD_AD.test(href)) oldLinks.push(`${path} -> ${href}`);
        if (!seen.has(href)) {
          seen.add(href);
          queue.push(href);
        }
      }
    }

    // Links found on the visited pages that were not opened as pages: check that each one answers.
    const rest = [...seen].filter((href) => !visited.has(href));
    for (const href of rest) {
      const res = await request.get(href);
      if (res.status() >= 400) broken.push(`${res.status()} ${href}`);
    }

    expect(visited.size).toBe(PAGE_LIMIT);
    expect(oldLinks, "old /ad/ links").toEqual([]);
    expect(broken, "broken internal links").toEqual([]);
  });
});
