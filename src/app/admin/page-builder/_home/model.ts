import type { BlockBase } from "@/server/models/layout";

export type Props = Record<string, unknown>;

export const BLOCK_NAMES: Record<string, string> = {
  homeBanner: "Banner",
  homeCategories: "Categories",
  homeAds: "Home ads",
  homeSteps: "How it works",
  homeTrust: "Trust bar",
  latestPosts: "Latest blog posts",
};

/** Block types the page can hold, in the order they are offered by Add block. */
export const BLOCK_TYPES = Object.keys(BLOCK_NAMES);

export const H1_MAX = 120;
export const TITLE_MAX = 120;
export const STEP_MAX = 3;
export const TRUST_MAX = 5;

export const DEFAULT_PROPS: Record<string, Props> = {
  homeBanner: { h1: "Find what you need", textInImage: false, subline: "", showSearch: true },
  homeCategories: { eyebrow: "", title: "Popular categories", allText: "", count: 4, source: "catalogue", picked: [] },
  homeAds: { eyebrow: "", title: "Latest ads in {city}", moreText: "", listLabel: "" },
  homeSteps: { eyebrow: "", title: "How it works", items: [] },
  homeTrust: { items: [] },
  latestPosts: { title: "From the blog", count: 3 },
};

export type Problem = { blockId: string; field: string; message: string };

const text = (value: unknown) => (typeof value === "string" ? value : "");
const list = (value: unknown): Props[] => (Array.isArray(value) ? (value as Props[]) : []);

export function nameOf(block: Pick<BlockBase, "type">): string {
  return BLOCK_NAMES[block.type] ?? block.type;
}

/** The grey line under a block's name in the block list. */
export function summaryOf(block: BlockBase, slotsPicked: number): string {
  const props = block.props as Props;
  switch (block.type) {
    case "homeBanner":
      return text(props.h1) || "Picture and headline";
    case "homeCategories":
      return `${Number(props.count) || 4} categories`;
    case "homeAds":
      return `8 slots, ${slotsPicked} picked`;
    case "homeSteps": {
      const count = list(props.items).length;
      return `${count} ${count === 1 ? "step" : "steps"}`;
    }
    case "homeTrust":
      return list(props.items)
        .map((item) => text(item.label))
        .filter(Boolean)
        .join(" · ") || "No items";
    case "latestPosts":
      return `${Number(props.count) || 3} newest posts`;
    default:
      return "";
  }
}

export function withProps(blocks: BlockBase[], id: string, patch: Props): BlockBase[] {
  return blocks.map((block) => (block.id === id ? { ...block, props: { ...block.props, ...patch } } : block));
}

export function withVisible(blocks: BlockBase[], id: string, visible: boolean): BlockBase[] {
  return blocks.map((block) => (block.id === id ? { ...block, visible } : block));
}

export function moveBlock(blocks: BlockBase[], from: number, to: number): BlockBase[] {
  if (from === to || from < 0 || to < 0 || from >= blocks.length || to >= blocks.length) return blocks;
  const next = blocks.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function newBlock(type: string, taken: ReadonlySet<string>): BlockBase {
  let id = `new-${type}`;
  for (let n = 2; taken.has(id); n += 1) id = `new-${type}-${n}`;
  return { id, type, visible: true, startsAt: null, endsAt: null, props: structuredClone(DEFAULT_PROPS[type] ?? {}) };
}

/** What is sent to the server and compared to find unsaved changes. Ids are left out: the server gives new blocks their ids. */
export function stable(blocks: readonly BlockBase[]): string {
  return JSON.stringify(blocks.map((block) => ({ type: block.type, visible: block.visible, props: block.props })));
}

/** How many blocks differ from the other list (added, removed, moved, hidden or edited). */
export function changeCount(base: readonly BlockBase[], now: readonly BlockBase[]): number {
  const one = (block: BlockBase | undefined) => (block ? JSON.stringify({ type: block.type, visible: block.visible, props: block.props }) : "");
  let n = 0;
  for (let i = 0; i < Math.max(base.length, now.length); i += 1) if (one(base[i]) !== one(now[i])) n += 1;
  return n;
}

/** Fields that stop a save, with the block they belong to. The server checks again. */
export function problemsOf(blocks: readonly BlockBase[]): Problem[] {
  const out: Problem[] = [];
  for (const block of blocks) {
    const props = block.props as Props;
    const add = (field: string, message: string) => out.push({ blockId: block.id, field, message });
    if (block.type === "homeBanner") {
      const picture = props.imageDesktop as { src?: string; alt?: string } | null | undefined;
      if (!picture?.src) add("image", "Choose a picture for laptops.");
      else if (text(picture.alt).trim().length < 3) add("alt", "Describe the picture in at least 3 characters.");
      if (!text(props.h1).trim()) add("h1", "Write the headline.");
      else if (text(props.h1).length > H1_MAX) add("h1", `Keep the headline to ${H1_MAX} characters.`);
    }
    if (["homeCategories", "homeAds", "homeSteps", "latestPosts"].includes(block.type) && !text(props.title).trim()) add("title", "Write a title.");
    if (block.type === "homeSteps") {
      list(props.items).forEach((item, index) => {
        if (!text(item.title).trim()) add(`step-${index}`, `Write a title for step ${index + 1}.`);
      });
    }
    if (block.type === "homeTrust") {
      list(props.items).forEach((item, index) => {
        if (!text(item.label).trim()) add(`trust-${index}`, `Write item ${index + 1} or remove it.`);
      });
    }
  }
  return out;
}

export function problemFor(problems: readonly Problem[], blockId: string, field: string): string | undefined {
  return problems.find((item) => item.blockId === blockId && item.field === field)?.message;
}

/** "10 s ago", "2 min ago": how long since the draft was saved. */
export function agoLabel(from: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - from) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds - (seconds % 10)} s ago`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} h ago`;
}
