import type { ComponentType } from "react";
import { fillTemplate, type SeoVars } from "@/lib/seo";
import type { BlockBase } from "@/server/models/layout";
import { BannerBlock } from "./BannerBlock";
import { FaqBlock } from "./FaqBlock";
import { RichTextBlock } from "./RichTextBlock";
import { SeoTextBlock } from "./SeoTextBlock";
import { StepsBlock } from "./StepsBlock";
import { TrustBlock } from "./TrustBlock";
import "./blocks.css";

// Block types without a component here render nothing. More arrive with the pages that use them (H3.4 to H3.6).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COMPONENTS: Record<string, ComponentType<any>> = {
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

export function deviceClass(devices: BlockBase["devices"]) {
  if (!devices || devices.length !== 1) return undefined;
  return devices[0] === "mobile" ? "tk-only-mobile" : "tk-only-desktop";
}

export function BlockRenderer({ blocks, vars = {} }: { blocks: BlockBase[]; vars?: SeoVars }) {
  return (
    <>
      {blocks.map((block) => {
        const Component = COMPONENTS[block.type];
        if (!Component) return null;
        return (
          <div key={block.id} className={deviceClass(block.devices)} data-block={block.type}>
            <Component {...(fillProps(block.props, vars) as Record<string, unknown>)} />
          </div>
        );
      })}
    </>
  );
}
