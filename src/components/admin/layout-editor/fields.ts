/**
 * Client-safe description of every layout block: its fields, defaults and limits.
 * Keep in step with src/server/layout/blocks.ts (the server validates everything again on save).
 */

import { HERO_OVERLAY_COLOR, HERO_OVERLAY_MAX_OPACITY, HERO_OVERLAY_OPACITY, HERO_VERSION, heroOverlayOn, layoutFor } from "@/lib/layout/hero";

export type Props = Record<string, unknown>;

export type Field =
  | { kind: "text"; key: string; label: string; max: number; required?: boolean; multiline?: boolean; help?: string }
  | { kind: "richText"; key: string; label: string; max: number; required?: boolean }
  | { kind: "image"; key: string; label: string; help?: string; banner?: boolean }
  | { kind: "color"; key: string; label: string; def: string; help?: string }
  | { kind: "link"; key: string; label: string }
  | { kind: "number"; key: string; label: string; min: number; max: number; def?: number }
  | { kind: "select"; key: string; label: string; options: readonly (readonly [string, string])[]; def: string | ((props: Props) => string) }
  | { kind: "boolean"; key: string; label: string; def: boolean | ((props: Props) => boolean) }
  | { kind: "stringList"; key: string; label: string; max: number; itemMax: number; itemLabel: string; def?: readonly string[] }
  | { kind: "multiSelect"; key: string; label: string; options: readonly string[]; def: readonly string[] }
  | { kind: "items"; key: string; label: string; max: number; itemName: string; titleKey: string; fields: Field[] };

export interface BlockMeta {
  label: string;
  hint: string;
  deletable: boolean;
  max?: number;
  defaults: Props;
  fields: Field[];
  /** Blocks with a live preview in the editor. */
  preview?: "hero";
}

const text = (key: string, label: string, max: number, extra: { required?: boolean; multiline?: boolean; help?: string } = {}): Field => ({
  kind: "text",
  key,
  label,
  max,
  ...extra,
});
const image = (key: string, label: string, help?: string): Field => ({ kind: "image", key, label, ...(help ? { help } : {}) });
const link = (key: string, label: string): Field => ({ kind: "link", key, label });
const toggle = (key: string, label: string, def: boolean | ((props: Props) => boolean)): Field => ({ kind: "boolean", key, label, def });
const num = (key: string, label: string, min: number, max: number, def?: number): Field => ({ kind: "number", key, label, min, max, def });
const choice = (key: string, label: string, options: readonly (readonly [string, string])[], def: string): Field => ({
  kind: "select",
  key,
  label,
  options,
  def,
});
/** Upload size and recommended sizes for the hero banner (H6.13). */
const BANNER_HELP = {
  desktop: "Up to 8 MB (2 MB or less loads faster). Recommended 1920 x 640 px.",
  mobile: "Up to 8 MB (2 MB or less loads faster). Recommended 1080 x 1350 px. Leave empty to use the desktop banner on phones.",
};
const CARD_IMAGE_HELP = "Best size 1080 x 1350 (portrait). Desktop shows the middle part in a wider frame.";
const title = text("title", "Title", 120);
const linkListFields: Field[] = [title, num("max", "How many to show", 1, 30, 10)];

export const BLOCK_META: Record<string, BlockMeta> = {
  hero: {
    label: "Hero",
    hint: "Big top section with a heading, sub-heading and search. The preview below shows phone and desktop widths.",
    deletable: true,
    max: 1,
    defaults: { heading: "Find what you need", layout: "full", heroVersion: HERO_VERSION },
    preview: "hero",
    fields: [
      text("heading", "Heading", 120, { required: true, help: "This is the page heading. It stays on the page for search engines even when it is hidden." }),
      text("subheading", "Sub-heading", 300, { multiline: true }),
      text("searchPlaceholder", "Search box hint", 80),
      link("primaryCta", "Main button"),
      link("secondaryCta", "Second button"),
      {
        kind: "select",
        key: "layout",
        label: "Layout",
        options: [["full", "Full banner: one photo across the whole hero"], ["split", "Split: photo on the right"]],
        def: layoutFor,
      },
      { kind: "image", key: "imageDesktop", label: "Image for desktop", help: BANNER_HELP.desktop, banner: true },
      { kind: "image", key: "imageMobile", label: "Image for phone (optional)", help: BANNER_HELP.mobile, banner: true },
      choice("height", "Height", [["auto", "From the image shape"], ["small", "Small"], ["medium", "Medium"], ["large", "Large"], ["full", "Full screen"]], "auto"),
      choice("fit", "Image fit", [["cover", "Fill the area (edges may be cropped)"], ["contain", "Show the whole image (bars may show)"]], "cover"),
      choice("focus", "Focal point", [["left", "Left"], ["center", "Centre"], ["right", "Right"], ["top", "Top"], ["bottom", "Bottom"]], "top"),
      toggle("overlayOn", "Dark layer over image", heroOverlayOn),
      { kind: "color", key: "overlayColor", label: "Layer colour", def: HERO_OVERLAY_COLOR, help: "Used when the dark layer is on." },
      num("overlayOpacity", "Layer opacity (%)", 0, HERO_OVERLAY_MAX_OPACITY, HERO_OVERLAY_OPACITY),
      toggle("showHeadline", "Show heading", true),
      toggle("showSubtext", "Show sub-heading", true),
      toggle("showSearch", "Show search box", true),
      choice("textAlign", "Text position: side", [["left", "Left"], ["center", "Centre"], ["right", "Right"]], "left"),
      choice("textVertical", "Text position: height", [["top", "Top"], ["middle", "Middle"], ["bottom", "Bottom"]], "bottom"),
      choice("textTone", "Text colour", [["light", "Light"], ["dark", "Dark"]], "light"),
      toggle("textShadow", "Text shadow (for readability)", false),
      link("bannerLink", "Whole-banner link (only when heading, sub-heading and search are all hidden)"),
    ],
  },
  categoryGrid: {
    label: "Category cards",
    hint: "Grid of category cards",
    deletable: true,
    defaults: { title: "Browse categories" },
    fields: [
      title,
      text("intro", "Intro line", 300, { multiline: true }),
      {
        kind: "items",
        key: "items",
        label: "Cards",
        max: 24,
        itemName: "card",
        titleKey: "label",
        fields: [
          text("categorySlug", "Category slug", 80, { required: true, help: "Lower-case letters, numbers and dashes, for example property" }),
          text("label", "Card title", 60),
          text("blurb", "Short text", 160),
          image("image", "Card image", CARD_IMAGE_HELP),
          choice(
            "focus",
            "Photo focal point",
            [["center", "Centre"], ["top", "Top"], ["bottom", "Bottom"], ["left", "Left"], ["right", "Right"]],
            "center",
          ),
        ],
      },
      num("columnsDesktop", "Columns on desktop", 2, 6, 3),
      toggle("showCounts", "Show ad counts", false),
    ],
  },
  cityLinks: {
    label: "City links",
    hint: "Row of links to city pages",
    deletable: true,
    defaults: { title: "Browse by city" },
    fields: [
      title,
      choice("mode", "Which cities", [["top", "Top cities automatically"], ["manual", "Choose them below"]], "top"),
      { kind: "stringList", key: "citySlugs", label: "City slugs (when choosing)", max: 30, itemMax: 80, itemLabel: "City slug" },
      text("categorySlug", "Only for category (slug)", 80),
      num("max", "How many to show", 1, 60, 12),
    ],
  },
  latestAds: {
    label: "Latest ads",
    hint: "Newest ads feed",
    deletable: true,
    defaults: { title: "Latest ads" },
    fields: [
      title,
      choice("source", "Which ads", [["all", "All cities"], ["visitorCity", "The visitor's city"], ["fixedCity", "One chosen city"]], "all"),
      text("citySlug", "City slug (for one chosen city)", 80),
      text("categorySlug", "Only category (slug)", 80),
      num("count", "How many ads", 4, 24, 8),
      choice("layout", "Layout", [["grid", "Grid"], ["list", "List"]], "grid"),
      toggle("showPhotos", "Show photos", true),
    ],
  },
  featuredAds: {
    label: "Featured ads",
    hint: "Hand-picked ads",
    deletable: true,
    defaults: { title: "Featured" },
    fields: [title, { kind: "stringList", key: "listingIds", label: "Ad IDs", max: 24, itemMax: 64, itemLabel: "Ad ID" }],
  },
  banner: {
    label: "Banner",
    hint: "Image banner with a link",
    deletable: true,
    defaults: { title: "" },
    fields: [
      image("image", "Image"),
      text("title", "Title", 120),
      text("text", "Text", 300, { multiline: true }),
      link("link", "Link"),
      choice("theme", "Colour theme", [["brand", "Brand"], ["neutral", "Neutral"], ["accent", "Accent"]], "brand"),
    ],
  },
  richText: {
    label: "Text block",
    hint: "A heading and formatted text",
    deletable: true,
    defaults: { title: "", body: "" },
    fields: [text("title", "Title", 120), { kind: "richText", key: "body", label: "Text", max: 2000 }],
  },
  faq: {
    label: "Questions and answers",
    hint: "FAQ list",
    deletable: true,
    defaults: { title: "Questions" },
    fields: [
      title,
      {
        kind: "items",
        key: "items",
        label: "Questions",
        max: 8,
        itemName: "question",
        titleKey: "q",
        fields: [text("q", "Question", 200, { required: true }), { kind: "richText", key: "a", label: "Answer", max: 1000, required: true }],
      },
    ],
  },
  steps: {
    label: "Steps",
    hint: "Numbered how-it-works steps",
    deletable: true,
    defaults: { title: "How it works" },
    fields: [
      title,
      {
        kind: "items",
        key: "items",
        label: "Steps",
        max: 6,
        itemName: "step",
        titleKey: "title",
        fields: [text("icon", "Icon name", 40), text("title", "Step title", 80, { required: true }), text("text", "Step text", 300, { multiline: true })],
      },
    ],
  },
  trust: {
    label: "Trust points",
    hint: "Short reassurance points",
    deletable: true,
    defaults: {},
    fields: [
      {
        kind: "items",
        key: "items",
        label: "Points",
        max: 6,
        itemName: "point",
        titleKey: "text",
        fields: [text("icon", "Icon name", 40), text("text", "Text", 120, { required: true })],
      },
    ],
  },
  seoText: {
    label: "SEO text",
    hint: "Longer text for search engines and readers",
    deletable: true,
    defaults: { body: "" },
    fields: [text("title", "Title", 120), { kind: "richText", key: "body", label: "Text", max: 4000 }],
  },
  listingHeader: {
    label: "Listing header",
    hint: "H1 and intro of a listing page",
    deletable: false,
    max: 1,
    defaults: { h1Template: "{category} in {city}", introTemplate: "" },
    fields: [
      text("h1Template", "Heading template", 200, { required: true, help: "Use {category} and {city} where the names should appear" }),
      text("introTemplate", "Intro template", 600, { multiline: true }),
      toggle("showCount", "Show the number of ads", true),
      toggle("showUpdated", "Show the last updated date", true),
    ],
  },
  filters: {
    label: "Filters",
    hint: "Filter bar",
    deletable: true,
    max: 1,
    defaults: {},
    fields: [
      { kind: "stringList", key: "enabled", label: "Filters to show", max: 12, itemMax: 40, itemLabel: "Filter key", def: ["verified", "photos"] },
      choice("showOnMobileAs", "On phones show as", [["inline", "Inline"], ["sheet", "Pop-up sheet"]], "inline"),
    ],
  },
  listingFeed: {
    label: "Ad feed",
    hint: "The list of ads",
    deletable: false,
    max: 1,
    defaults: { emptyTitle: "No ads here yet", emptyText: "Check back soon." },
    fields: [
      num("perPage", "Ads per page", 12, 48, 24),
      {
        kind: "multiSelect",
        key: "cardFields",
        label: "Show on each card",
        options: ["photo", "price", "location", "date", "attributes", "badges"],
        def: ["photo", "location", "badges"],
      },
      text("inFeedBlockId", "Banner block id inside the feed", 80),
      num("inFeedEvery", "Show that banner every N ads", 4, 30),
      text("emptyTitle", "Title when there are no ads", 120, { required: true }),
      text("emptyText", "Text when there are no ads", 300, { multiline: true }),
    ],
  },
  districtLinks: { label: "District links", hint: "Links to areas", deletable: true, defaults: { title: "Areas" }, fields: linkListFields },
  nearbyCities: { label: "Nearby cities", hint: "Links to nearby cities", deletable: true, defaults: { title: "Nearby cities" }, fields: linkListFields },
  relatedCategories: {
    label: "Related categories",
    hint: "Links to related categories",
    deletable: true,
    defaults: { title: "Related categories" },
    fields: linkListFields,
  },
  postIntro: {
    label: "Post page intro",
    hint: "Heading above the posting form",
    deletable: true,
    max: 1,
    defaults: { title: "Post an ad" },
    fields: [text("title", "Title", 120, { required: true }), text("text", "Text", 500, { multiline: true }), image("image", "Image")],
  },
  postStep: {
    label: "Post step",
    hint: "Words of one posting step",
    deletable: false,
    max: 6,
    defaults: { stepKey: "basics", title: "Basics" },
    fields: [
      choice(
        "stepKey",
        "Step",
        [["basics", "Basics"], ["details", "Details"], ["photos", "Photos"], ["contact", "Contact"], ["review", "Review"], ["promote", "Promote"]],
        "basics",
      ),
      text("title", "Title", 80, { required: true }),
      text("help", "Help text", 300, { multiline: true }),
      text("nextLabel", "Next button", 40),
      text("backLabel", "Back button", 40),
    ],
  },
  photoRules: {
    label: "Photo rules",
    hint: "Rules shown beside photo upload",
    deletable: true,
    max: 1,
    defaults: { title: "Photo rules" },
    fields: [title, { kind: "stringList", key: "items", label: "Rules", max: 10, itemMax: 200, itemLabel: "Rule" }],
  },
  promotionPicker: {
    label: "Promotion picker",
    hint: "Choose how to promote an ad",
    deletable: true,
    max: 1,
    defaults: { title: "Promote your ad" },
    fields: [
      title,
      { kind: "stringList", key: "products", label: "Product codes", max: 10, itemMax: 40, itemLabel: "Product code" },
      text("defaultCode", "Preselected product code", 40),
      text("note", "Note", 300, { multiline: true }),
    ],
  },
  postSuccess: {
    label: "Post success",
    hint: "Page shown after posting",
    deletable: true,
    max: 1,
    defaults: { title: "Your ad is live" },
    fields: [
      text("title", "Title", 120, { required: true }),
      text("text", "Text", 500, { multiline: true }),
      link("primaryCta", "Main button"),
      link("secondaryCta", "Second button"),
    ],
  },
};

export function metaFor(type: string): BlockMeta {
  return BLOCK_META[type] ?? { label: type, hint: "", deletable: true, defaults: {}, fields: [] };
}

const isRecord = (value: unknown): value is Props => typeof value === "object" && value !== null && !Array.isArray(value);

/** Copy of `props` without empty optional values, so the server's own defaults apply. Never changes the input. */
export function cleanProps(fields: readonly Field[], props: Props): Props {
  const out: Props = { ...props };
  for (const field of fields) {
    const value = props[field.key];
    switch (field.kind) {
      case "text":
      case "richText":
        if (typeof value !== "string" || (value === "" && !field.required)) delete out[field.key];
        break;
      case "number":
        if (typeof value !== "number" || !Number.isFinite(value)) delete out[field.key];
        break;
      case "select":
      case "boolean":
        if (value === undefined || value === null) delete out[field.key];
        break;
      case "image":
        if (!isRecord(value)) delete out[field.key];
        break;
      case "link":
        if (!isRecord(value) || (!String(value.label ?? "").trim() && !String(value.href ?? "").trim())) delete out[field.key];
        break;
      case "stringList":
        if (Array.isArray(value)) out[field.key] = value.map((entry) => String(entry).trim()).filter(Boolean);
        else delete out[field.key];
        break;
      case "multiSelect":
        if (!Array.isArray(value)) delete out[field.key];
        break;
      case "items":
        if (Array.isArray(value)) out[field.key] = value.filter(isRecord).map((item) => cleanProps(field.fields, item));
        else delete out[field.key];
        break;
    }
  }
  return out;
}
