import type { SiteContent } from "@/lib/ui/site-content";
import type { BlockBase } from "@/server/models/layout";

const HERO_SIZE = { width: 960, height: 880 };
const CARD_SIZE = { width: 600, height: 402 };

/**
 * The current home page (hero, category cards, SEO text) written as blocks, so the page looks the same once it is rendered from a layout.
 * Images are the built-in placeholders; ids are filled in on the server when the layout is saved.
 */
export function homeDefaultBlocks(content: SiteContent): Omit<BlockBase, "id">[] {
  const blocks: Omit<BlockBase, "id">[] = [
    {
      type: "hero",
      visible: true,
      label: "Hero",
      props: {
        heading: content.hero.desktop,
        searchPlaceholder: content.hero.searchPlaceholder,
        imageDesktop: {
          assetId: "builtin-hero",
          src: content.hero.photo,
          alt: content.hero.photoAlt || "Tharkoo home page photo",
          ...HERO_SIZE,
        },
        primaryCta: { label: content.hero.postLabel, href: content.hero.postHref },
      },
    },
    {
      type: "categoryGrid",
      visible: true,
      label: "Category cards",
      props: {
        title: content.cardsHeading,
        intro: content.cardsIntro,
        columnsDesktop: 3,
        showCounts: false,
        items: content.cards
          .filter((card) => card.visible)
          .map((card) => ({
            categorySlug: card.slug,
            ...(card.title ? { label: card.title } : {}),
            ...(card.blurb ? { blurb: card.blurb } : {}),
            ...(card.cities.length ? { citySlugs: card.cities.slice(0, 8) } : {}),
            ...(card.photo
              ? { image: { assetId: `builtin-${card.slug}`, src: card.photo, alt: `${card.title || card.slug} classifieds`, ...CARD_SIZE } }
              : {}),
          })),
      },
    },
  ];
  if (content.seoIntro.trim()) {
    blocks.push({ type: "seoText", visible: true, label: "SEO text", props: { body: content.seoIntro } });
  }
  return blocks;
}
