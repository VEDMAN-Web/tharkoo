import type { ReactNode } from "react";
import { isListingBuiltin, listingScopes } from "@/lib/layout/listing";
import { getPageBlocks } from "@/lib/layout/read";
import type { SeoVars } from "@/lib/seo";
import { listingDefaultBlocks } from "@/server/layout/defaults/listing";
import type { BlockBase } from "@/server/models/layout";
import { BlockRenderer } from "./BlockRenderer";

/** What a listing page needs to follow its layout: the block list, template values and the pre-drawn generic blocks. */
export interface ListingLayout {
  blocks: BlockBase[];
  vars: Record<string, string | number | undefined>;
  nodes: Record<string, ReactNode>;
}

/**
 * Picks the layout for a listing page (exact URL, then category, then default) and draws the blocks the page does not draw itself.
 * With nothing published (or if the layout cannot be read) the built-in default is used, which is the page as it always was.
 */
export async function resolveListingLayout(input: { path: string; category: string; vars: ListingLayout["vars"] }): Promise<ListingLayout> {
  let published: BlockBase[] | null = null;
  try {
    published = await getPageBlocks("listing", listingScopes(input.path, input.category));
  } catch (error) {
    console.error("listing layout could not be read, using the built-in layout", error);
  }
  const blocks = [...(published ?? listingDefaultBlocks())];
  // A hand-made layout that lacks the heading or the ads would leave the page without an h1 or without listings: put them back.
  const defaults = listingDefaultBlocks();
  if (!blocks.some((block) => block.type === "listingHeader")) blocks.unshift(defaults.find((block) => block.type === "listingHeader")!);
  if (!blocks.some((block) => block.type === "listingFeed")) {
    blocks.splice(blocks.findIndex((block) => block.type === "listingHeader") + 1, 0, defaults.find((block) => block.type === "listingFeed")!);
  }
  const nodes: ListingLayout["nodes"] = {};
  for (const block of blocks) {
    if (!isListingBuiltin(block.type)) nodes[block.id] = <BlockRenderer blocks={[block]} vars={input.vars as SeoVars} />;
  }
  return { blocks, vars: input.vars, nodes };
}
