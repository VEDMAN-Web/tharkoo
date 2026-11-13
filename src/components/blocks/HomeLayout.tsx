import { JsonLd } from "@/lib/jsonld";
import { canonical } from "@/lib/seo";
import { websiteNode } from "@/lib/seo/schema";
import { siteOrganizationNode } from "@/lib/seo-site";
import { getHomepageContent, getSite } from "@/lib/queries";
import { searchPath } from "@/lib/urls";
import { getPaths } from "@/server/urls/service";
import type { BlockBase } from "@/server/models/layout";
import { BlockRenderer } from "./BlockRenderer";

/** Text for the hidden h1 when no hero and no titled rich text block is left on the page (UI text key `home.h1` comes in H3.7). */
export const HOME_H1_FALLBACK = "Tharkoo classifieds in India";

/** The h1 comes from the hero. If the hero is hidden or deleted: the first rich text block's title, else a visually hidden h1. */
export function pickH1(blocks: BlockBase[]): { blockId?: string; hidden: boolean } {
  if (blocks.some((block) => block.type === "hero")) return { hidden: false };
  const rich = blocks.find((block) => block.type === "richText" && typeof block.props.title === "string" && block.props.title.trim());
  if (rich) return { blockId: rich.id, hidden: false };
  return { hidden: true };
}

/** Renders the home page from blocks, plus the site-wide JSON-LD that the built-in home page also writes. */
export async function HomeLayout({ blocks }: { blocks: BlockBase[] }) {
  const [site, content, paths] = await Promise.all([getSite(), getHomepageContent(), getPaths()]);
  const h1 = pickH1(blocks);
  return (
    <>
      <JsonLd
        data={[
          await siteOrganizationNode(site.name || "Tharkoo", {
            logo: canonical("/brand/logo-mark.svg"),
            sameAs: content.socials.map((item) => item.href),
          }),
          websiteNode(site.name || "Tharkoo", searchPath(paths)),
        ]}
      />
      {h1.hidden ? <h1 className="sr-only">{HOME_H1_FALLBACK}</h1> : null}
      <BlockRenderer blocks={blocks} h1Block={h1.blockId} />
    </>
  );
}
