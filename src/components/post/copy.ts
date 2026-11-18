import type { BlockBase } from "@/server/models/layout";

/** The six step keys of a post-ad layout, in wizard order. Kept here so client code does not import the zod registry. */
export const POST_STEPS = ["basics", "details", "photos", "contact", "review", "promote"] as const;
export type PostStepKey = (typeof POST_STEPS)[number];

export interface StepCopy {
  title: string;
  help: string;
  nextLabel: string;
  backLabel: string;
}

export interface CtaCopy {
  label: string;
  /** Empty means the post-ad page itself (its path can be changed in the URL settings). */
  href: string;
}

export interface PostCopy {
  intro: { title: string; text: string; image: { src: string; alt: string; width: number; height: number } | null } | null;
  steps: Record<PostStepKey, StepCopy>;
  /** Only the promote step can be hidden. */
  promoteHidden: boolean;
  photoRules: { title: string; items: string[] };
  promotion: { title: string; products: string[]; defaultCode: string; note: string };
  success: { title: string; text: string; primaryCta: CtaCopy | null; secondaryCta: CtaCopy | null };
  /** Site texts (`post.*`) the idCheckFirst, payStep and consent blocks replace, by key. Empty block fields are left out. */
  texts: Record<string, string>;
}

/** Block field -> site text key, for the blocks that hold texts only (H8.41). */
export const POST_BLOCK_TEXT_KEYS: Record<string, Record<string, string>> = {
  idCheckFirst: {
    verifyTitle: "post.idcheck.verifyTitle",
    verifyText: "post.idcheck.verifyText",
    verifyButton: "post.idcheck.verifyButton",
    checkingTitle: "post.idcheck.checkingTitle",
    checkingText: "post.idcheck.checkingText",
    backLink: "post.idcheck.backToAccount",
  },
  payStep: {
    title: "post.pay.title",
    feeLabel: "post.pay.fee",
    balanceLabel: "post.pay.yourBalance",
    afterLabel: "post.pay.after",
    creditsTitle: "post.pay.creditsTitle",
    topUpLabel: "post.pay.topUp",
  },
  consent: {
    agree: "post.reviewStep.agreePrefix",
    terms: "post.reviewStep.terms",
    and: "post.reviewStep.and",
    privacy: "post.reviewStep.privacy",
    adult: "post.reviewStep.adult",
  },
};

/** The wording the wizard has always had. The wizard shows these whenever no layout is published. */
export const POST_COPY_DEFAULTS: PostCopy = {
  intro: null,
  steps: {
    basics: { title: "What are you posting?", help: "Pick a category. This helps the right people find your ad.", nextLabel: "Continue", backLabel: "" },
    details: { title: "Describe your ad", help: "", nextLabel: "", backLabel: "" },
    photos: { title: "Photos", help: "Add a photo of the item or place. People ads can use a portrait.", nextLabel: "Continue", backLabel: "Back" },
    contact: { title: "Your contacts", help: "", nextLabel: "", backLabel: "" },
    review: { title: "Publish", help: "", nextLabel: "PUBLISH", backLabel: "Back" },
    promote: { title: "Plan", help: "", nextLabel: "", backLabel: "" },
  },
  promoteHidden: false,
  photoRules: { title: "", items: ["JPG, PNG or WEBP, any size. Big photos are made smaller for you."] },
  promotion: { title: "", products: [], defaultCode: "", note: "Your ad is published once it passes our checks." },
  success: {
    title: "Your ad is live",
    text: "",
    primaryCta: { label: "Your ads", href: "/u/account/ads/" },
    secondaryCta: { label: "Post another ad", href: "" },
  },
  texts: {},
};

const LEGACY_BACK_LABEL = "BACK";
const LEGACY_TITLES: Partial<Record<PostStepKey, string>> = { basics: "Information", details: "Your data" };

type Props = Record<string, unknown>;

const str = (value: unknown): string => (typeof value === "string" ? value : "");
const strList = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item !== "") : []);

function cta(value: unknown): CtaCopy | null {
  if (!value || typeof value !== "object") return null;
  const { label, href } = value as Props;
  return str(label) && str(href) ? { label: str(label), href: str(href) } : null;
}

function image(value: unknown): NonNullable<PostCopy["intro"]>["image"] {
  if (!value || typeof value !== "object") return null;
  const { src, alt, width, height } = value as Props;
  if (!str(src) || typeof width !== "number" || typeof height !== "number") return null;
  return { src: str(src), alt: str(alt), width, height };
}

/**
 * Turns the published post-ad blocks into the plain object the wizard shows.
 * Missing blocks and empty labels fall back to the current wording, so the wizard never shows a blank button.
 * `blocks` is what `getPageBlocks("post", ...)` returns: hidden blocks are already gone.
 */
export function buildPostCopy(blocks: readonly BlockBase[] | null | undefined): PostCopy {
  if (!blocks) return POST_COPY_DEFAULTS;
  const copy: PostCopy = {
    ...POST_COPY_DEFAULTS,
    steps: Object.fromEntries(POST_STEPS.map((key) => [key, { ...POST_COPY_DEFAULTS.steps[key] }])) as Record<PostStepKey, StepCopy>,
    texts: {},
  };
  let sawStep = false;
  let sawPromote = false;
  for (const block of blocks) {
    const props = block.props as Props;
    if (block.type === "postStep") {
      const key = str(props.stepKey) as PostStepKey;
      if (!(POST_STEPS as readonly string[]).includes(key)) continue;
      sawStep = true;
      if (key === "promote") sawPromote = true;
      const base = POST_COPY_DEFAULTS.steps[key];
      copy.steps[key] = {
        title: !str(props.title) || str(props.title) === LEGACY_TITLES[key] ? base.title : str(props.title),
        help: str(props.help) || (key === "basics" ? base.help : ""),
        nextLabel: str(props.nextLabel) || base.nextLabel,
        backLabel: !str(props.backLabel) || str(props.backLabel) === LEGACY_BACK_LABEL ? base.backLabel : str(props.backLabel),
      };
    } else if (block.type === "postIntro") {
      copy.intro = { title: str(props.title), text: str(props.text), image: image(props.image) };
    } else if (block.type === "photoRules") {
      copy.photoRules = { title: str(props.title), items: strList(props.items) };
    } else if (block.type === "promotionPicker") {
      copy.promotion = { title: str(props.title), products: strList(props.products), defaultCode: str(props.defaultCode), note: str(props.note) };
    } else if (POST_BLOCK_TEXT_KEYS[block.type]) {
      for (const [field, key] of Object.entries(POST_BLOCK_TEXT_KEYS[block.type])) {
        const value = str(props[field]).trim();
        if (value) copy.texts[key] = value;
      }
    } else if (block.type === "postSuccess") {
      copy.success = {
        title: str(props.title) || POST_COPY_DEFAULTS.success.title,
        text: str(props.text),
        primaryCta: cta(props.primaryCta),
        secondaryCta: cta(props.secondaryCta),
      };
    }
  }
  copy.promoteHidden = sawStep && !sawPromote;
  return copy;
}

/** A category field as the wizard needs it. */
export interface WizardField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options: string[];
  placeholder: string;
  help: string;
  /** Most picks for a pick-many field, or null for the default. */
  maxPicks: number | null;
}

/** The age field every people category gets when its own form has none (H10.1): required, 18 to 99. */
export const BUILT_IN_AGE_FIELD: WizardField = { key: "age", label: "Age", type: "number", required: true, options: [], placeholder: "", help: "", maxPicks: null };

interface RawField {
  key?: unknown;
  label?: unknown;
  type?: unknown;
  required?: unknown;
  options?: unknown;
  placeholder?: unknown;
  help?: unknown;
  order?: unknown;
  enabled?: unknown;
  maxPicks?: unknown;
}

/** Category fields in the order the admin set, without the ones switched off. */
export function wizardFields(fields: readonly RawField[] | null | undefined): WizardField[] {
  return (fields ?? [])
    .filter((field) => typeof field.key === "string" && field.key !== "" && field.enabled !== false)
    .map((field, index) => ({ field, index }))
    .sort((a, b) => (Number(a.field.order) || 0) - (Number(b.field.order) || 0) || a.index - b.index)
    .map(({ field }) => ({
      key: String(field.key),
      label: str(field.label),
      type: str(field.type),
      required: field.required === true,
      options: strList(field.options),
      placeholder: str(field.placeholder),
      help: str(field.help),
      maxPicks: typeof field.maxPicks === "number" && field.maxPicks > 0 ? Math.floor(field.maxPicks) : null,
    }));
}

const FEE_TOKEN = /\{fee\}/g;

/** "1 credit", "30 credits": the posting fee as visitors read it. */
export function feeLabel(fee: number): string {
  return `${fee} ${fee === 1 ? "credit" : "credits"}`;
}

/** `{fee}` in a text becomes today's posting fee (for example "30 credits"). */
export function fillFee(text: string, fee: string): string {
  return text.replace(FEE_TOKEN, fee);
}

/** The block wording with `{fee}` filled in everywhere an admin can type it. The input is not changed. */
export function fillCopyFee(copy: PostCopy, fee: string): PostCopy {
  const step = (row: StepCopy): StepCopy => ({ title: fillFee(row.title, fee), help: fillFee(row.help, fee), nextLabel: fillFee(row.nextLabel, fee), backLabel: fillFee(row.backLabel, fee) });
  return {
    ...copy,
    intro: copy.intro ? { ...copy.intro, title: fillFee(copy.intro.title, fee), text: fillFee(copy.intro.text, fee) } : null,
    steps: Object.fromEntries(POST_STEPS.map((key) => [key, step(copy.steps[key])])) as Record<PostStepKey, StepCopy>,
    photoRules: { title: fillFee(copy.photoRules.title, fee), items: copy.photoRules.items.map((item) => fillFee(item, fee)) },
    promotion: { ...copy.promotion, title: fillFee(copy.promotion.title, fee), note: fillFee(copy.promotion.note, fee) },
    success: { ...copy.success, title: fillFee(copy.success.title, fee), text: fillFee(copy.success.text, fee) },
  };
}
