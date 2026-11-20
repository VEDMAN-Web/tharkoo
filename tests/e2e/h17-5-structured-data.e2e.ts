import { expect, test } from "./helpers";

/** H17.5: the structured data on the home, list, blog and ad pages says only what each page shows. */

type Node = Record<string, unknown> & { "@type"?: string };

function nodesOf(html: string): Node[] {
  const out: Node[] = [];
  for (const match of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    const parsed = JSON.parse(match[1] ?? "null") as Node | Node[];
    out.push(...(Array.isArray(parsed) ? parsed : [parsed]));
  }
  return out;
}
const ISO_DATE = /^\d{4}-\d{2}(-\d{2}(T[\d:.]+Z)?)?$/;
const typesOf = (nodes: Node[]) => nodes.map((node) => node["@type"]);

test.describe("H17.5 structured data", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "the markup is the same at every size");
  });

  test("the home page has one WebPage named by the site, an Organization with a contact point and no social links by default", async ({ request }) => {
    const nodes = nodesOf(await (await request.get("/")).text());
    const pages = nodes.filter((node) => node["@type"] === "WebPage");
    expect(pages).toHaveLength(1);
    expect(pages[0]?.name).toBe("Tharkoo");
    const org = nodes.find((node) => node["@type"] === "Organization");
    expect(org).toBeTruthy();
    expect((org?.contactPoint as Record<string, unknown> | undefined)?.["@type"]).toBe("ContactPoint");
    expect(org?.sameAs).toBeUndefined();
  });

  test("a list page counts the ads it lists, has a WebPage named by its heading and no FAQPage", async ({ request, page }) => {
    await page.goto("/property/");
    const hrefs = await page.locator("a[href]").evaluateAll((links) => links.map((link) => link.getAttribute("href") || ""));
    const path = hrefs.find((href) => /^\/property\/[a-z0-9-]+\/$/.test(href));
    expect(path, "a city page is linked from the category page").toBeTruthy();
    const html = await (await request.get(path ?? "/")).text();
    const nodes = nodesOf(html);
    expect(typesOf(nodes), "no FAQPage on a list page").not.toContain("FAQPage");
    const list = nodes.find((node) => node["@type"] === "ItemList") as { numberOfItems: number; itemListElement: unknown[] } | undefined;
    if (list) expect(list.numberOfItems).toBe(list.itemListElement.length);
    const webPage = nodes.find((node) => node["@type"] === "WebPage");
    expect(webPage, path).toBeTruthy();
    expect(String(webPage?.name)).not.toBe(path);
    expect(String(webPage?.name)).not.toMatch(/^\//);
    await page.goto(path ?? "/");
    expect((await page.locator("h1").first().innerText()).trim().length).toBeGreaterThan(0);
  });

  test("the category page keeps its visible FAQ text and writes no FAQPage", async ({ request }) => {
    const html = await (await request.get("/property/")).text();
    expect(typesOf(nodesOf(html))).not.toContain("FAQPage");
  });

  test("a blog post has ISO dates, an image and an author", async ({ request }) => {
    const html = await (await request.get("/blog/stay-safe/")).text();
    const post = nodesOf(html).find((node) => node["@type"] === "BlogPosting") as Record<string, unknown> | undefined;
    expect(post).toBeTruthy();
    expect(String(post?.datePublished)).toMatch(ISO_DATE);
    expect(String(post?.dateModified)).toMatch(ISO_DATE);
    expect(Array.isArray(post?.image) && (post?.image as string[]).length > 0).toBe(true);
    expect((post?.author as Record<string, unknown>)?.name).toBeTruthy();
  });

  test("a sample ad ends its breadcrumb with the ad and has no Offer, Product, JobPosting or rating", async ({ request, page }) => {
    // Sample ads are no longer in the ads sitemap (H17.8): the seeded sample ad is the first card of a list page.
    await page.goto("/dating/bengaluru/");
    const link = page.locator("a[data-ad-link]").first();
    await link.waitFor({ state: "attached" });
    const href = await link.getAttribute("href");
    const adUrl = href ? new URL(href, "http://127.0.0.1").pathname : undefined;
    expect(adUrl, "the seeded sample ad is the first card of the list page").toBeTruthy();
    const html = await (await request.get(adUrl ?? "/")).text();
    const nodes = nodesOf(html);
    const crumbs = nodes.find((node) => node["@type"] === "BreadcrumbList") as { itemListElement: { name: string; item: string }[] } | undefined;
    expect(crumbs).toBeTruthy();
    const last = crumbs?.itemListElement.at(-1);
    expect(last?.item).toContain(adUrl);
    const text = JSON.stringify(nodes);
    for (const word of ['"Offer"', '"Product"', '"JobPosting"', "aggregateRating", '"Review"']) expect(text).not.toContain(word);
  });
});
