import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

import { HomeBlocksV2 } from "@/components/new/home-blocks/HomeBlocksV2";
import { NewHome } from "@/components/new/NewHome";
import { BLOCK_TYPES, BLOCKS, blockDef, typesForPage } from "@/server/layout/blocks";
import { homeBlocksFrom } from "@/server/layout/home-v2";
import { HOME_FIXTURES, type HomeFixtureName } from "./a6-fixtures";

const NAMES = Object.keys(HOME_FIXTURES) as HomeFixtureName[];
const BASELINE = JSON.parse(readFileSync(new URL("./a6-home-baseline.json", import.meta.url), "utf8")) as Record<string, string>;
const V2_TYPES = ["homeBanner", "homeCategories", "homeAds", "homeSteps", "homeTrust", "latestPosts"];

function renderOld(name: HomeFixtureName) {
  return renderToStaticMarkup(createElement(NewHome, HOME_FIXTURES[name] as never));
}

function blocksFor(name: HomeFixtureName) {
  const fixture = HOME_FIXTURES[name];
  return homeBlocksFrom({ hero: fixture.hero, shell: fixture.shell, texts: fixture.texts, categoriesCount: fixture.categoriesCount });
}

function dataOf(name: HomeFixtureName) {
  const { categories, ads, shell, paths, countries, texts } = HOME_FIXTURES[name];
  return { categories, ads, shell, paths, countries, texts };
}

function renderV2(name: HomeFixtureName, blocks = blocksFor(name)) {
  const data = dataOf(name);
  return renderToStaticMarkup(createElement(HomeBlocksV2, { blocks, data: data as never }));
}

describe("NewHome after the split into home-blocks components", () => {
  for (const name of NAMES) {
    it(`renders byte-identical markup to the page before the split (${name})`, () => {
      expect(renderOld(name)).toBe(BASELINE[name]);
    });
  }
});

describe("HomeBlocksV2", () => {
  for (const name of NAMES) {
    it(`renders the same markup as NewHome for the blocks made from the same data (${name})`, () => {
      expect(renderV2(name)).toBe(renderOld(name));
    });
  }

  it("makes blocks that pass their own schemas", () => {
    for (const name of NAMES) {
      for (const block of blocksFor(name)) {
        const parsed = BLOCKS[block.type as keyof typeof BLOCKS].schema.safeParse(block.props);
        expect(parsed.success, `${name}/${block.type}: ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
      }
    }
  });

  it("leaves out a hidden block, the search form when switched off, and shows picked categories in the picked order", () => {
    const blocks = blocksFor("plain");
    const hidden = blocks.map((block) => (block.type === "homeSteps" ? { ...block, visible: false } : block));
    expect(renderV2("plain", hidden)).not.toContain("home-how");
    const noSearch = blocks.map((block) => (block.type === "homeBanner" ? { ...block, props: { ...block.props, showSearch: false } } : block));
    expect(renderV2("plain", noSearch)).not.toContain("<form");
    expect(renderV2("plain")).toContain("<form");
    const picked = blocks.map((block) => (block.type === "homeCategories" ? { ...block, props: { ...block.props, source: "picked", picked: ["wellness", "dating"] } } : block));
    const html = renderV2("plain", picked);
    const wellness = html.indexOf('tkh-cat-name">Wellness');
    expect(wellness).toBeGreaterThan(-1);
    expect(wellness).toBeLessThan(html.indexOf('tkh-cat-name">Dating'));
    expect(html).not.toContain('tkh-cat-name">Friendship');
  });

  it("renders latest posts only when posts are given", () => {
    const blocks = [...blocksFor("plain"), { id: "posts", type: "latestPosts", visible: true, props: { title: "From the blog", count: 2 } }];
    const data = dataOf("plain");
    const withPosts = renderToStaticMarkup(
      createElement(HomeBlocksV2, { blocks, data: { ...data, posts: [{ title: "One", href: "/blog/one/" }, { title: "Two", href: "/blog/two/" }, { title: "Three", href: "/blog/three/" }] } as never }),
    );
    expect(withPosts).toContain("From the blog");
    expect(withPosts).toContain("/blog/two");
    expect(withPosts).not.toContain("/blog/three");
    expect(renderV2("plain", blocks)).not.toContain("From the blog");
  });
});

describe("home block types", () => {
  it("adds the six format 2 types, one per page at most, hidden from the old editors", () => {
    for (const type of V2_TYPES) {
      expect(BLOCK_TYPES).toContain(type);
      expect(blockDef(type)?.max).toBe(1);
      expect(blockDef(type)?.pages).toEqual(["home"]);
      expect(typesForPage("home")).not.toContain(type);
    }
  });

  it("keeps the old home block types valid and offered", () => {
    for (const type of ["hero", "categoryGrid", "latestAds", "steps", "trust", "seoText"] as const) {
      expect(BLOCKS[type].schema.safeParse(BLOCKS[type].defaults()).success).toBe(true);
      expect(typesForPage("home")).toContain(type);
    }
  });

  it("rejects a banner without a heading, an image without alt text, and more than 3 steps", () => {
    expect(BLOCKS.homeBanner.schema.safeParse({ h1: "" }).success).toBe(false);
    expect(BLOCKS.homeBanner.schema.safeParse({ h1: "Hi there", imageDesktop: { src: "/a.webp", alt: "" } }).success).toBe(false);
    const items = Array.from({ length: 4 }, (_, index) => ({ title: `Step ${index}`, text: "" }));
    expect(BLOCKS.homeSteps.schema.safeParse({ title: "How", items }).success).toBe(false);
  });
});
