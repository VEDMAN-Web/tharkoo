import { POST_BLOCK_TEXT_KEYS } from "@/components/post/copy";
import type { BlockBase } from "@/server/models/layout";
import { changeCount, moveBlock, stable, withProps, withVisible, type Problem, type Props } from "../_home/model";

export { changeCount, moveBlock, stable, withProps, withVisible };
export type { Problem, Props };

export const STEP_NAMES: Record<string, string> = {
  basics: "Category step",
  details: "Details step",
  photos: "Photos step",
  contact: "Contact step",
  review: "Review step",
  promote: "Plan step",
};

export const BLOCK_NAMES: Record<string, string> = {
  postIntro: "Intro above the form",
  photoRules: "Photo rules",
  promotionPicker: "Plan choices",
  postSuccess: "After posting",
  idCheckFirst: "ID check first",
  payStep: "Pay and publish card",
  consent: "Terms and consent",
};

/** Blocks that can be added when the draft does not have them. The six steps are always there. */
export const ADDABLE = ["postIntro", "photoRules", "promotionPicker", "postSuccess", "idCheckFirst", "payStep", "consent"];

export const DEFAULT_PROPS: Record<string, Props> = {
  postIntro: { title: "Post an ad", text: "" },
  photoRules: { title: "", items: [] },
  promotionPicker: { title: "", products: [], note: "" },
  postSuccess: { title: "Your ad is live", text: "", primaryCta: null, secondaryCta: null },
  idCheckFirst: {},
  payStep: {},
  consent: {},
};

export const TITLE_MAX = 120;

const text = (value: unknown) => (typeof value === "string" ? value : "");
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const cta = (value: unknown) => (value && typeof value === "object" ? (value as { label?: unknown; href?: unknown }) : {});

export function nameOf(block: Pick<BlockBase, "type" | "props">): string {
  if (block.type === "postStep") return STEP_NAMES[text((block.props as Props).stepKey)] ?? "Step";
  return BLOCK_NAMES[block.type] ?? block.type;
}

/** A step other than the plan step always shows; it cannot be hidden. */
export function canHide(block: Pick<BlockBase, "type" | "props">): boolean {
  return block.type !== "postStep" || text((block.props as Props).stepKey) === "promote";
}

export function isTextsBlock(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(POST_BLOCK_TEXT_KEYS, type);
}

/** The grey line under a block's name in the block list. */
export function summaryOf(block: BlockBase): string {
  const props = block.props as Props;
  switch (block.type) {
    case "postIntro":
    case "postStep":
    case "postSuccess":
      return text(props.title) || "No title";
    case "photoRules": {
      const count = list(props.items).length;
      return `${count} ${count === 1 ? "rule" : "rules"}`;
    }
    case "promotionPicker": {
      const count = list(props.products).length;
      return count === 0 ? "All plans" : `${count} ${count === 1 ? "plan" : "plans"}`;
    }
    default: {
      const fields = Object.keys(POST_BLOCK_TEXT_KEYS[block.type] ?? {});
      const changed = fields.filter((field) => text(props[field]).trim() !== "").length;
      return changed === 0 ? "Uses the site texts" : `${changed} ${changed === 1 ? "text" : "texts"} changed`;
    }
  }
}

export function newBlock(type: string, taken: ReadonlySet<string>): BlockBase {
  let id = `new-${type}`;
  for (let n = 2; taken.has(id); n += 1) id = `new-${type}-${n}`;
  return { id, type, visible: true, startsAt: null, endsAt: null, props: structuredClone(DEFAULT_PROPS[type] ?? {}) };
}

/** Fields that stop a save, with the block they belong to. The server checks again. */
export function problemsOf(blocks: readonly BlockBase[]): Problem[] {
  const out: Problem[] = [];
  for (const block of blocks) {
    const props = block.props as Props;
    const add = (field: string, message: string) => out.push({ blockId: block.id, field, message });
    if (["postIntro", "postStep", "postSuccess"].includes(block.type)) {
      if (!text(props.title).trim()) add("title", "Write a title.");
      else if (text(props.title).length > (block.type === "postStep" ? 80 : TITLE_MAX)) add("title", `Keep the title to ${block.type === "postStep" ? 80 : TITLE_MAX} characters.`);
    }
    if (block.type === "photoRules") {
      list(props.items).forEach((item, index) => {
        if (!text(item).trim()) add(`rule-${index}`, `Write rule ${index + 1} or remove it.`);
      });
    }
    if (block.type === "promotionPicker") {
      list(props.products).forEach((item, index) => {
        if (!text(item).trim()) add(`product-${index}`, `Write plan code ${index + 1} or remove it.`);
      });
    }
    if (block.type === "postSuccess") {
      for (const key of ["primaryCta", "secondaryCta"] as const) {
        const one = cta(props[key]);
        const label = text(one.label).trim();
        const href = text(one.href).trim();
        if ((label && !href) || (!label && href)) add(key, "Write both the button text and its address, or clear both.");
      }
    }
  }
  return out;
}

export function problemFor(problems: readonly Problem[], blockId: string, field: string): string | undefined {
  return problems.find((item) => item.blockId === blockId && item.field === field)?.message;
}
