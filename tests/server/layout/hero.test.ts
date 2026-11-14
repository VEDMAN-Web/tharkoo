import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HeroBlock } from "@/components/blocks/HeroBlock";
import { heroOverlayOn, overlayRgba, resolveHero } from "@/lib/layout/hero";
import { BLOCKS } from "@/server/layout/blocks";
import { validateBlocks } from "@/server/layout/service";
import { homeDefaultBlocks } from "@/server/layout/defaults/home";

const none = new Set<string>();
const photo = { assetId: "a1", src: "/uploads/site/hero.webp", alt: "A bright living room", width: 1920, height: 640 };
const phonePhoto = { assetId: "a2", src: "/uploads/site/hero-phone.webp", alt: "A bright living room, close up", width: 1080, height: 1350 };

/** The hero as it was saved before H6.9: the old `overlay` key, no look fields. */
const legacyProps = {
  heading: "Find what you need",
  subheading: "Ads across India",
  imageDesktop: { ...photo, width: 960, height: 880 },
  searchPlaceholder: "Search by city",
  overlay: "light",
};

function render(props: Record<string, unknown>) {
  return renderToStaticMarkup(createElement(HeroBlock, props as never));
}

describe("hero settings (resolveHero)", () => {
  it("gives a block with no look fields the full banner, with no overlay (H6.13 default)", () => {
    expect(resolveHero({})).toEqual({
      layout: "full",
      fit: "cover",
      focus: "top",
      height: "auto",
      overlay: "none",
      overlayColor: "#2a2316",
      overlayOpacity: 40,
      showHeadline: true,
      showSubtext: true,
      showSearch: true,
      textAlign: "left",
      textVertical: "bottom",
      textTone: "light",
      textShadow: false,
    });
  });

  it("keeps the split hero and its gradient for an old block that has its own look settings", () => {
    expect(resolveHero({ ...legacyProps, textTone: "dark" })).toMatchObject({ layout: "split", overlay: "gradient" });
    expect(resolveHero({ ...legacyProps, overlay: "none", textTone: "dark" }).overlay).toBe("gradient");
  });

  it("shows an old block with no look settings as the full banner, and a versioned block with no layout as full", () => {
    expect(resolveHero(legacyProps)).toMatchObject({ layout: "full", overlay: "none" });
    expect(resolveHero({ heroVersion: 2, textTone: "dark" })).toMatchObject({ layout: "full", overlay: "none" });
  });

  it("keeps a layout the user chose, split or full, whatever the version", () => {
    expect(resolveHero({ layout: "split", heroVersion: 2 }).layout).toBe("split");
    expect(resolveHero({ layout: "split" }).layout).toBe("split");
    expect(resolveHero({ layout: "full" }).layout).toBe("full");
  });

  it("has no overlay for the full banner until the layer is switched on", () => {
    expect(resolveHero({ layout: "full" }).overlay).toBe("none");
    expect(resolveHero({ layout: "full", overlayOn: true }).overlay).toBe("color");
    expect(resolveHero({ layout: "full", overlayOn: true }).overlayColor).toBe("#2a2316");
  });

  it("turns the layer off when overlayOn is false, even on the split hero", () => {
    expect(resolveHero({ overlayOn: false }).overlay).toBe("none");
    expect(heroOverlayOn({ overlayOn: false })).toBe(false);
  });

  it("uses a colour layer when a colour or opacity is saved without the switch", () => {
    expect(resolveHero({ layout: "full", overlayColor: "#112233" }).overlay).toBe("color");
    expect(resolveHero({ overlayOpacity: 20 }).overlay).toBe("color");
    expect(heroOverlayOn({ layout: "full" })).toBe(false);
  });

  it("falls back to defaults for unknown values and clamps the opacity", () => {
    const settings = resolveHero({ layout: "sideways", fit: "stretch", overlayColor: "red", overlayOpacity: 500, textTone: "blue" });
    expect(settings.layout).toBe("split");
    expect(settings.fit).toBe("cover");
    expect(settings.overlayColor).toBe("#2a2316");
    expect(settings.overlayOpacity).toBe(80);
    expect(settings.textTone).toBe("light");
    expect(resolveHero({ overlayOpacity: -5 }).overlayOpacity).toBe(0);
  });

  it("formats the overlay colour as rgba with the chosen opacity", () => {
    expect(overlayRgba("#2a2316", 40)).toBe("rgba(42, 35, 22, 0.4)");
    expect(overlayRgba("#ffffff", 0)).toBe("rgba(255, 255, 255, 0)");
    expect(overlayRgba("#000000", 150)).toBe("rgba(0, 0, 0, 0.8)");
  });
});

describe("hero block defaults and saved data", () => {
  it("keeps the registry defaults valid: a new hero is a versioned full banner with no look fields", () => {
    expect(BLOCKS.hero.defaults()).toEqual({ heading: "Find what you need", layout: "full", heroVersion: 2 });
    expect(BLOCKS.hero.schema.safeParse(BLOCKS.hero.defaults()).success).toBe(true);
  });

  it("builds the home hero from the current page without the removed overlay key", () => {
    const hero = homeDefaultBlocks({
      hero: { desktop: "Hi", mobileLines: [], photo: "/placeholders/hero.webp", photoAlt: "Photo", searchPlaceholder: "Search", postLabel: "Post", postHref: "/post/" },
      cardsHeading: "",
      cardsIntro: "",
      cards: [],
      seoIntro: "",
    } as never).find((block) => block.type === "hero");
    expect(hero?.props).not.toHaveProperty("overlay");
    expect(hero?.props.heading).toBe("Hi");
  });

  it("accepts a block saved before H6.9 and keeps its data", () => {
    const [saved] = validateBlocks("home", [{ type: "hero", visible: true, props: legacyProps }], none);
    expect(saved.props.heading).toBe("Find what you need");
    expect(saved.props.overlay).toBeUndefined();
    expect(saved.props).not.toHaveProperty("layout");
    expect(resolveHero(saved.props)).toEqual(resolveHero({}));
  });

  it("accepts a full banner with its look fields", () => {
    const [saved] = validateBlocks(
      "home",
      [
        {
          type: "hero",
          visible: true,
          props: {
            heading: "Banner",
            imageDesktop: photo,
            imageMobile: phonePhoto,
            layout: "full",
            fit: "contain",
            focus: "bottom",
            height: "large",
            overlayOn: true,
            overlayColor: "#112233",
            overlayOpacity: 80,
            showHeadline: false,
            showSubtext: false,
            showSearch: false,
            textAlign: "right",
            textVertical: "middle",
            textTone: "dark",
            textShadow: true,
            bannerLink: { label: "Browse", href: "/categories/" },
          },
        },
      ],
      none,
    );
    expect(saved.props.layout).toBe("full");
    expect(saved.props.overlayOpacity).toBe(80);
  });

  it("rejects an opacity over 80, a bad colour and an unknown layout", () => {
    const hero = (props: Record<string, unknown>) => validateBlocks("home", [{ type: "hero", visible: true, props: { heading: "Hi", ...props } }], none);
    expect(() => hero({ overlayOpacity: 90 })).toThrow();
    expect(() => hero({ overlayOpacity: 12.5 })).toThrow();
    expect(() => hero({ overlayColor: "#abc" })).toThrow(/colour/);
    expect(() => hero({ layout: "sideways" })).toThrow();
  });

  it("keeps the hero limited to one per home page", () => {
    const two = [
      { type: "hero", visible: true, props: { heading: "A" } },
      { type: "hero", visible: true, props: { heading: "B" } },
    ];
    expect(() => validateBlocks("home", two, none)).toThrow(/at most 1/);
  });
});

describe("hero rendering", () => {
  it("renders an old block that set a look setting as the split hero it had", () => {
    const html = render({ ...legacyProps, textTone: "dark" });
    expect(html).toContain('data-layout="split"');
    expect(html).toContain('data-overlay="gradient"');
    expect(html).toContain('data-height="auto"');
    expect(html).toContain("<h1>Find what you need</h1>");
    expect(html).toContain('class="tk-hero-sub"');
    expect(html).toContain("tk-hero-search");
    expect(html).not.toContain("sr-only");
    expect(html).not.toContain("tk-hero-link");
  });

  it("renders an old block with no look settings as a full banner with no gradient", () => {
    const html = render(legacyProps);
    expect(html).toContain('data-layout="full"');
    expect(html).toContain('data-overlay="none"');
  });

  it("uses the plain theme colour when the banner photo is removed, and keeps the text", () => {
    const html = render({ heading: "Find what you need", searchPlaceholder: "Search", layout: "full" });
    expect(html).not.toContain("tk-hero-photo");
    expect(html).not.toContain("data-ar-d");
    expect(html).not.toContain("--ar-d-h");
    expect(html).toContain("<h1>Find what you need</h1>");
    expect(html).toContain("tk-hero-search");
  });

  it("sets the banner height ratio from the desktop photo, and from the phone photo on phones", () => {
    expect(render({ heading: "Hi", imageDesktop: photo })).toContain("--ar-d-h:0.3333333333333333");
    const both = render({ heading: "Hi", imageDesktop: photo, imageMobile: phonePhoto });
    expect(both).toContain("--ar-d-h:0.3333333333333333");
    expect(both).toContain("--ar-m-h:1.25");
    expect(render({ heading: "Hi", imageMobile: phonePhoto })).toContain("--ar-d-h:1.25");
  });

  it("renders a full banner with no text, no overlay and a banner link", () => {
    const html = render({
      heading: "Browse Tharkoo",
      imageDesktop: photo,
      layout: "full",
      showHeadline: false,
      showSubtext: false,
      showSearch: false,
      bannerLink: { label: "Browse all", href: "/categories/" },
    });
    expect(html).toContain('data-layout="full"');
    expect(html).toContain('data-overlay="none"');
    expect(html).toContain('class="sr-only"');
    expect(html).not.toContain("tk-hero-search");
    expect(html).toContain('aria-label="Browse all"');
    expect(html).toContain("tk-hero-link");
  });

  it("does not show the banner link while the search or text is on", () => {
    const html = render({
      heading: "Hi",
      imageDesktop: photo,
      layout: "full",
      showSearch: true,
      bannerLink: { label: "Browse all", href: "/categories/" },
    });
    expect(html).not.toContain("tk-hero-link");
  });

  it("drops an unsafe banner link", () => {
    const html = render({
      heading: "Hi",
      layout: "full",
      showHeadline: false,
      showSubtext: false,
      showSearch: false,
      bannerLink: { label: "Bad", href: "javascript:alert(1)" },
    });
    expect(html).not.toContain("tk-hero-link");
  });

  it("shows the phone photo only on phones when both photos are set", () => {
    const html = render({ heading: "Hi", imageDesktop: photo, imageMobile: phonePhoto, layout: "full" });
    expect(html).toContain("tk-hero-photo tk-only-desktop");
    expect(html).toContain("tk-hero-photo tk-only-mobile");
  });

  it("uses the desktop photo on phones when no phone photo is set", () => {
    const html = render({ heading: "Hi", imageDesktop: photo, layout: "full" });
    expect(html).not.toContain("tk-only-mobile");
    expect(html).not.toContain("tk-only-desktop");
  });

  it("sets the overlay colour, focal point and image fit from the settings", () => {
    const html = render({
      heading: "Hi",
      imageDesktop: photo,
      layout: "full",
      overlayOn: true,
      overlayColor: "#112233",
      overlayOpacity: 25,
      focus: "left",
      fit: "contain",
      textShadow: true,
      textTone: "dark",
    });
    expect(html).toContain("--hero-overlay:rgba(17, 34, 51, 0.25)");
    expect(html).toContain('data-fit="contain"');
    expect(html).toContain("object-position:left center");
    expect(html).toContain("object-fit:contain");
    expect(html).toContain('data-shadow="on"');
    expect(html).toContain('data-tone="dark"');
  });
});
