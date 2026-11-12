import type { ComponentType } from "react";
import { fillTemplate, type SeoVars } from "@/lib/seo";
import type { BlockBase } from "@/server/models/layout";
import { BannerBlock } from "./BannerBlock";
import { CategoryGridBlock } from "./CategoryGridBlock";
import { CityLinksBlock } from "./CityLinksBlock";
import { FaqBlock } from "./FaqBlock";
import { FeaturedAdsBlock } from "./FeaturedAdsBlock";
import { HeroBlock } from "./HeroBlock";
import { LatestAdsBlock } from "./LatestAdsBlock";
import { RichTextBlock } from "./RichTextBlock";
import { SeoTextBlock } from "./SeoTextBlock";
import { StepsBlock } from "./StepsBlock";
import { TrustBlock } from "./TrustBlock";
import { deviceClass } from "./device";
import "./blocks.css";

// Block types without a component here render nothing. More arrive with the pages that use them (H3.4 to H3.6).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COMPONENTS: Record<string, ComponentType<any>> = {
  hero: HeroBlock,
  categoryGrid: CategoryGridBlock,
  cityLinks: CityLinksBlock,
  latestAds: LatestAdsBlock,
  featuredAds: FeaturedAdsBlock,
  richText: RichTextBlock,
  banner: BannerBlock,
  faq: FaqBlock,
  steps: StepsBlock,
  trust: TrustBlock,
  seoText: SeoTextBlock,
};

/** Replaces {category} {city} {district} {count} ... in every string of the props. */
function fillProps(value: unknown, vars: SeoVars): unknown {
  if (typeof value === "string") return value.includes("{") ? fillTemplate(value, vars) : value;
  if (Array.isArray(value)) return value.map((item) => fillProps(item, vars));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fillProps(item, vars)]));
  }
  return value;
}

/** `h1Block` is the id of the block whose title should be the page h1 (used when a page has no hero). */
export function BlockRenderer({ blocks, vars = {}, h1Block }: { blocks: BlockBase[]; vars?: SeoVars; h1Block?: string }) {
  return (
    <>
      {blocks.map((block) => {
        const Component = COMPONENTS[block.type];
        if (!Component) return null;
        return (
          <div key={block.id} className={deviceClass(block.devices)} data-block={block.type}>
            <Component {...(fillProps(block.props, vars) as Record<string, unknown>)} {...(h1Block === block.id ? { as: "h1" } : {})} />
          </div>
        );
      })}
    </>
  );
}

export { deviceClass };
