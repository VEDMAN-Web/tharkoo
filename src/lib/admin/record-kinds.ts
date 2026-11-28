import { z } from "zod";
import type { Perm } from "@/lib/admin/perms";

export const RECORD_KINDS = ["banned-words", "broadcasts", "flags", "help-sections", "blog-posts", "help-topics"] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];
export type RecordModel = "BannedWord" | "Banner" | "FeatureFlag" | "HelpArticle" | "BlogPost";

export type FieldDef = {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "switch" | "image";
  help?: string;
  max?: number;
  required?: boolean;
  options?: { value: string; label: string }[];
  createOnly?: boolean;
  /** A web address that follows this field while a new record is typed, until the address is edited by hand. */
  slugFrom?: string;
  /** For "image": the field that takes the picture's description. */
  altField?: string;
  /** Shown only while this other field has a value. */
  showWhen?: string;
  /** For "select": the choices are the site's own top categories, read when the screen opens. */
  optionsFrom?: "categories";
  /** A new record starts with today's date, written as readers see it. */
  today?: boolean;
};

export type KindConfig = {
  kind: RecordKind;
  model: RecordModel;
  path: string;
  title: string;
  purpose: string;
  singular: string;
  newLabel: string;
  searchPlaceholder: string;
  searchFields: string[];
  sort: Record<string, 1 | -1>;
  view: Perm;
  write: Perm;
  remove: Perm;
  fields: FieldDef[];
  schema: z.ZodType;
  nameField: string;
  subField?: string;
  columns: string[];
  switchField?: string;
  termList?: boolean;
  /** All / Published / Draft chips above the table. For kinds whose records have a "status" of "published" or "draft". */
  statusFilter?: boolean;
  /** A wider drawer, for records with long text. */
  wide?: boolean;
  deleteNote: string;
};

export const TEXT_MAX = 300;
export const BODY_MAX = 20000;
export const PAGE_SIZES = [25, 50, 100] as const;

const link = z
  .string()
  .max(200, "Use at most 200 characters.")
  .refine((value) => value === "" || /^(\/(?!\/)|https:\/\/)/.test(value), "Start with / for a page on this site, or https:// for another site.");
const count = z.preprocess((value) => (value === "" || value === undefined || value === null ? undefined : value), z.number().int().min(0, "Use 0 or more.").max(9999, "Use 9,999 or less.").optional());
const word = (label: string, max: number) => z.string().trim().min(1, `Enter ${label}.`).max(max, `Use at most ${max} characters.`);

const bannedWordSchema = z.object({
  text: word("the word or phrase", 80),
  matchType: z.string().trim().max(40),
  scope: z.string().trim().max(40),
  action: z.string().trim().max(40),
});

const broadcastSchema = z.object({
  slot: word("where it shows", 40),
  title: word("a title", 100),
  body: z.string().trim().max(TEXT_MAX, `Use at most ${TEXT_MAX} characters.`),
  href: link,
  cta: z.string().trim().max(40, "Use at most 40 characters."),
  enabled: z.boolean(),
  order: count,
});

const flagSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "Enter a key.")
    .max(60, "Use at most 60 characters.")
    .regex(/^[a-z0-9][a-z0-9._-]*$/, "Use lowercase letters, numbers, dots, dashes or underscores."),
  label: word("a name", 100),
  enabled: z.boolean(),
});

const helpSchema = z.object({
  title: word("a title", 120),
  slug: z
    .string()
    .trim()
    .min(1, "Enter a web address.")
    .max(80, "Use at most 80 characters.")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single dashes."),
  section: z.string().trim().max(60, "Use at most 60 characters."),
  order: count,
  status: z.enum(["published", "draft"], { message: "Choose published or draft." }),
  body: z.string().max(BODY_MAX, `Use at most ${BODY_MAX.toLocaleString("en-IN")} characters.`),
});

const blogSchema = z.object({
  title: word("a title", 120),
  slug: helpSchema.shape.slug,
  date: z.string().trim().max(40, "Use at most 40 characters."),
  author: z.string().trim().max(80, "Use at most 80 characters."),
  category: z.string().trim().max(60, "Use at most 60 characters."),
  cover: link,
  coverAlt: z.string().trim().max(200, "Use at most 200 characters."),
  coverFocus: z.string().trim().max(40, "Use at most 40 characters."),
  status: helpSchema.shape.status,
  body: helpSchema.shape.body,
});

const MATCH = [
  { value: "contains", label: "Anywhere in the text" },
  { value: "whole", label: "Whole word only" },
  { value: "exact", label: "The whole text is exactly this" },
];
const SCOPE = [
  { value: "all", label: "Ads and messages" },
  { value: "ads", label: "Ads only" },
  { value: "messages", label: "Messages only" },
];
const ACTION = [
  { value: "block", label: "Stop it from posting" },
  { value: "review", label: "Send it to review" },
];

const helpSections: KindConfig = {
  kind: "help-sections",
  model: "HelpArticle",
  path: "/admin/help-sections/",
  title: "Help sections",
  purpose: "The articles in the help centre, by section. Each change can be undone for 30 days.",
  singular: "article",
  newLabel: "New article",
  searchPlaceholder: "Search articles",
  searchFields: ["title", "section", "slug"],
  sort: { section: 1, order: 1, title: 1 },
  view: "settings.edit",
  write: "settings.edit",
  remove: "settings.edit",
  nameField: "title",
  subField: "slug",
  columns: ["section", "status"],
  deleteNote: "The article is deleted and its page stops working. This cannot be undone. Set it to draft instead if you may want it back.",
  schema: helpSchema,
  fields: [
    { name: "title", label: "Title", type: "text", max: 120, required: true },
    { name: "slug", label: "Web address", type: "text", max: 80, required: true, help: "Lowercase words joined by dashes, for example how-to-post." },
    { name: "section", label: "Section", type: "text", max: 60, help: "The group it sits in, for example Getting started." },
    { name: "order", label: "Order in the section", type: "number", help: "Lowest number first." },
    { name: "status", label: "Status", type: "select", options: [{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }] },
    { name: "body", label: "Text", type: "textarea", max: BODY_MAX },
  ],
};

const BLOG_POSTS_CONFIG: KindConfig = {
  kind: "blog-posts",
  model: "BlogPost",
  path: "/admin/blog-posts/",
  title: "Blog posts",
  purpose: "The built-in blog posts the site shows today. Edit the words, set one to draft, or remove it. Changes can be undone for 30 days.",
  singular: "post",
  newLabel: "New post",
  searchPlaceholder: "Search posts",
  searchFields: ["title", "slug", "category"],
  sort: { date: -1, title: 1 },
  view: "content.write",
  write: "content.write",
  remove: "content.publish",
  nameField: "title",
  subField: "slug",
  columns: ["category", "status"],
  statusFilter: true,
  wide: true,
  deleteNote: "The post is deleted and its page stops working. This cannot be undone. Set it to draft instead if you may want it back.",
  schema: blogSchema,
  fields: [
    { name: "title", label: "Title", type: "text", max: 120, required: true },
    { name: "slug", label: "Web address", type: "text", max: 80, required: true, slugFrom: "title", help: "Made from the title. Lowercase words joined by dashes. Changing it later breaks old links." },
    { name: "cover", label: "Cover picture", type: "image", max: 200, altField: "coverAlt", help: "Optional. With none, the post keeps the pink band." },
    { name: "coverAlt", label: "What the cover shows", type: "text", max: 200, showWhen: "cover" },
    { name: "coverFocus", label: "Part to keep when cropped", type: "text", max: 40, showWhen: "cover", help: "Optional, for example 60% 40%." },
    { name: "body", label: "Text", type: "textarea", max: BODY_MAX, help: "Leave an empty line between paragraphs. Start a line with ## to make a heading." },
    { name: "category", label: "Category", type: "select", optionsFrom: "categories", help: "The site's categories. They are managed under Categories & fields." },
    { name: "author", label: "Author", type: "text", max: 80 },
    { name: "date", label: "Date shown", type: "text", max: 40, today: true, help: "As readers see it, for example 3 November 2026." },
    { name: "status", label: "Status", type: "select", options: [{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }] },
  ],
};

export const KINDS: Record<RecordKind, KindConfig> = {
  "banned-words": {
    kind: "banned-words",
    model: "BannedWord",
    path: "/admin/banned-words/",
    title: "Banned words",
    purpose: "Words and phrases the title check flags. Each change is logged and can be undone for 30 days.",
    singular: "word",
    newLabel: "New word",
    searchPlaceholder: "Search words",
    searchFields: ["text"],
    sort: { text: 1 },
    view: "settings.edit",
    write: "settings.edit",
    remove: "settings.edit",
    nameField: "text",
    columns: ["matchType", "scope", "action"],
    termList: true,
    deleteNote: "The word is removed from the list. This cannot be undone.",
    schema: bannedWordSchema,
    fields: [
      { name: "text", label: "Word or phrase", type: "text", max: 80, required: true, help: "Lower case is fine. Matching ignores capital letters." },
      { name: "matchType", label: "How it matches", type: "select", options: MATCH },
      { name: "scope", label: "Where it applies", type: "select", options: SCOPE },
      { name: "action", label: "What happens", type: "select", options: ACTION },
    ],
  },
  broadcasts: {
    kind: "broadcasts",
    model: "Banner",
    path: "/admin/broadcasts/",
    title: "Broadcasts",
    purpose: "Notices shown to visitors. Switch one off to hide it without deleting it. Each change can be undone for 30 days.",
    singular: "notice",
    newLabel: "New notice",
    searchPlaceholder: "Search notices",
    searchFields: ["title", "body", "slot"],
    sort: { order: 1, title: 1 },
    view: "settings.edit",
    write: "settings.edit",
    remove: "settings.edit",
    nameField: "title",
    subField: "body",
    columns: ["slot"],
    switchField: "enabled",
    deleteNote: "The notice is deleted. This cannot be undone. Switch it off instead if you may want it back.",
    schema: broadcastSchema,
    fields: [
      { name: "title", label: "Title", type: "text", max: 100, required: true, help: "What people see first." },
      { name: "body", label: "Message", type: "textarea", max: TEXT_MAX, help: "One or two short sentences." },
      { name: "slot", label: "Where it shows", type: "text", max: 40, required: true, help: "The place on the site, for example top-bar." },
      { name: "href", label: "Link", type: "text", max: 200, help: "Optional. Start with / for a page on this site." },
      { name: "cta", label: "Button words", type: "text", max: 40, help: "Optional, for example See offers." },
      { name: "order", label: "Order", type: "number", help: "Lowest number first." },
      { name: "enabled", label: "Show this notice", type: "switch" },
    ],
  },
  flags: {
    kind: "flags",
    model: "FeatureFlag",
    path: "/admin/flags/",
    title: "Feature flags",
    purpose: "Switches for parts of the product. Only a superadmin can change them. Each change can be undone for 30 days.",
    singular: "flag",
    newLabel: "New flag",
    searchPlaceholder: "Search flags",
    searchFields: ["key", "label"],
    sort: { key: 1 },
    view: "raw.json",
    write: "raw.json",
    remove: "raw.json",
    nameField: "label",
    subField: "key",
    columns: [],
    switchField: "enabled",
    deleteNote: "The flag is deleted. This cannot be undone.",
    schema: flagSchema,
    fields: [
      { name: "label", label: "Name", type: "text", max: 100, required: true, help: "What this switch does, in plain words." },
      { name: "key", label: "Key", type: "text", max: 60, required: true, createOnly: true, help: "Lowercase. Code looks the switch up by this key, so it cannot change later." },
      { name: "enabled", label: "On", type: "switch" },
    ],
  },
  "help-sections": helpSections,
  "help-topics": {
    ...helpSections,
    kind: "help-topics",
    path: "/admin/help-topics/",
    title: "Help topics",
    purpose: "The built-in help articles the site shows today. Edit the words, set one to draft, or remove it. Changes can be undone for 30 days.",
    view: "content.write",
    write: "content.write",
    remove: "content.publish",
  },
  "blog-posts": BLOG_POSTS_CONFIG,
};

export function isRecordKind(value: string): value is RecordKind {
  return (RECORD_KINDS as readonly string[]).includes(value);
}

export function emptyValues(config: KindConfig): Record<string, unknown> {
  const defaults: Record<string, unknown> = { matchType: "contains", scope: "all", action: "block", enabled: true, status: "published", order: "" };
  const today = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  return Object.fromEntries(config.fields.map((field) => [field.name, field.name in defaults ? defaults[field.name] : field.type === "switch" ? false : field.today ? today : ""]));
}
