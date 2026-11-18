import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CategoriesView } from "@/components/h714/CategoriesView";
import { HowItWorksView } from "@/components/h714/HowItWorksView";
import { BlogList, type BlogPostCard } from "@/components/new/BlogView";

const post = (slug: string, cover: BlogPostCard["cover"]): BlogPostCard => ({
  slug,
  title: `Post ${slug}`,
  date: "November 2026",
  body: "A short first paragraph for the card.",
  category: "Tips",
  href: `/blog/${slug}/`,
  cover,
});

const render = (posts: BlogPostCard[]) =>
  renderToStaticMarkup(createElement(BlogList, { posts, categories: [], active: "", page: 1, pages: 1, basePath: "/blog/" }));

describe("H12.1 public page layout", () => {
  it("How it works shows no photo box when no picture is set, and never the words Video call photo", () => {
    const html = renderToStaticMarkup(createElement(HowItWorksView, { postAdHref: "/post/", faqs: [], packsText: "Packs from 99" }));
    expect(html).not.toContain("Video call photo");
    const withPhoto = renderToStaticMarkup(
      createElement(HowItWorksView, { postAdHref: "/post/", faqs: [], packsText: "Packs from 99", photo: { src: "/uploads/call.png", alt: "Two people on a video call" } }),
    );
    expect(withPhoto).toContain("Two people on a video call");
    expect(withPhoto).not.toContain("Video call photo");
  });

  it("a category without a photo gets an icon tile, not an empty photo box", () => {
    const html = renderToStaticMarkup(
      createElement(CategoriesView, {
        categories: [{ slug: "dating", name: "Dating", summary: "Dating notices", href: "/dating/", photo: "" }],
        searchHref: "/search/",
        postAdHref: "/post/",
      }),
    );
    expect(html).toContain("h714-catico");
    expect(html).not.toContain("h714-catimg");
    expect(html).toContain("h714-arrow");
  });

  it("blog cards without a cover are text cards with the same Read article link", () => {
    const html = render([post("a", null), post("b", null), post("c", { src: "/uploads/c.png", alt: "Cover", focus: "50% 50%" })]);
    expect(html.match(/tkp-feature-plain/g)?.length).toBe(1);
    expect(html.match(/class="tkp-post-cover"/g)?.length).toBe(1);
    expect(html).not.toContain("tkp-feature-cover");
    expect(html.match(/Read article/g)?.length).toBe(3);
    expect(html).not.toContain("Read the article");
  });

  it("the safety page keeps every paragraph and the Report a listing link", () => {
    const page = readFileSync("src/app/safety/page.tsx", "utf8");
    expect(page).toContain('trustKey="safety"');
    const legal = readFileSync("src/components/new/TrustLegalPage.tsx", "utf8");
    expect(legal).toContain("Report a listing");
    expect(legal).toContain("/scam-report/");
  });
});
