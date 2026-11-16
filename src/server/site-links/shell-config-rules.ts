import { z } from "zod";
import { safeHref } from "@/lib/sanitize";
import { SUPPORT_TOPICS, type SupportTopic } from "@/server/support/constants";

/**
 * H7.1: every line of text, link and contact detail in the new header, footer and support chat.
 * These are the defaults; the stored value overrides them field by field. Pure, so client and server share it.
 */

export const SHELL_ICONS = ["home", "grid", "pin", "book", "help", "mail", "info", "shield", "user", "tag"] as const;
export type ShellIcon = (typeof SHELL_ICONS)[number];

export const CONTACT_KINDS = ["email", "phone", "whatsapp", "telegram", "hours", "address"] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

export type ShellLink = { label: string; href: string; visible: boolean; icon: ShellIcon };
export type ShellContact = { kind: ContactKind; label: string; value: string; href: string; visible: boolean };
export type ShellTopic = { label: string; topic: SupportTopic };
export const TRUST_TONES = ["pink", "green", "violet", "sky", "amber"] as const;
export type TrustTone = (typeof TRUST_TONES)[number];
export type TrustPill = { label: string; tone: TrustTone };
export type HowStep = { title: string; text: string };
/** H7.4: a band image for a listing page title band (desktop and phone), or a category card photo (`photo`). */
export type ShellImage = { scope: "category" | "city" | "state"; slug: string; photo: string; band: string; bandPhone: string };

export type ShellConfig = {
  header: { navLinks: ShellLink[]; loginLabel: string; postLabel: string };
  footer: {
    about: string;
    trust: string[];
    quickLinks: ShellLink[];
    /** Empty means "the first six categories from the catalogue". */
    topCategories: ShellLink[];
    contacts: ShellContact[];
    legal: ShellLink[];
    socials: ShellLink[];
    adultNotice: string;
    copyright: string;
  };
  chat: {
    title: string;
    status: string;
    welcome: string;
    guestHint: string;
    whatsapp: string;
    telegram: string;
    phone: string;
    topics: ShellTopic[];
  };
  /** H7.4: the New design home page text. */
  home: { trust: TrustPill[]; steps: HowStep[] };
  /** H7.4: category photos and listing title band images. Empty means the built-in gradient. */
  media: { images: ShellImage[] };
};

const link = (label: string, href: string, icon: ShellIcon): ShellLink => ({ label, href, visible: true, icon });

export function defaultShellConfig(): ShellConfig {
  return {
    header: {
      navLinks: [
        link("Home", "/", "home"),
        link("Categories", "/categories/", "grid"),
        link("Cities", "/cities/", "pin"),
        link("How it works", "/how-it-works/", "info"),
        link("Help", "/help/", "help"),
      ],
      loginLabel: "Log in",
      postLabel: "Post your ad",
    },
    footer: {
      about: "Post free ads, chat online and verify on a video call before you meet. Across India and more countries.",
      trust: ["Photo verified", "Private chat", "Free to post"],
      quickLinks: [
        link("Home", "/", "home"),
        link("Browse ads", "/search/", "grid"),
        link("Categories", "/categories/", "grid"),
        link("Cities and areas", "/cities/", "pin"),
        link("Blog", "/blog/", "book"),
        link("Help and support", "/help/", "help"),
        link("Contact", "/contact/", "mail"),
      ],
      topCategories: [],
      contacts: [],
      legal: [
        link("About us", "/cms/about/", "info"),
        link("Privacy Policy", "/privacy/", "shield"),
        link("Terms", "/terms/", "shield"),
        link("Cookie Policy", "/cookies/", "shield"),
        link("Grievance officer", "/grievance/", "user"),
      ],
      socials: [],
      adultNotice: "Dating section is for adults 18+ only",
      copyright: "© 2026 Tharkoo",
    },
    chat: {
      title: "Tharkoo support",
      status: "Online now, usually replies in minutes",
      welcome: "Hi! How can we help you today?",
      guestHint: "Add your name and an email or phone so support can reply.",
      whatsapp: "",
      telegram: "",
      phone: "",
      topics: [
        { label: "Help with my ad", topic: "my_ads" },
        { label: "Coins and payments", topic: "coins_payments" },
        { label: "Report a problem", topic: "report_problem" },
      ],
    },
    home: {
      trust: [
        { label: "Free to post", tone: "pink" },
        { label: "Chat online now", tone: "green" },
        { label: "Video call and verify", tone: "violet" },
        { label: "Photo verified badges", tone: "sky" },
        { label: "Ads live for 72 hours", tone: "pink" },
      ],
      steps: [
        { title: "Post for free", text: "Add photos and videos, pick a category and city." },
        { title: "Chat online", text: "Buyers message you on Tharkoo or WhatsApp and can ask for more photos." },
        { title: "Verify on video", text: "A short live video call shows the item or place is real before anyone meets." },
      ],
    },
    media: { images: [] },
  };
}

const MAX_TEXT = 200;
const MAX_ABOUT = 400;
const MAX_LINKS = 12;

/** Strips markup and control characters, then trims and caps the length. */
export function cleanShellText(value: unknown, max = MAX_TEXT): string {
  if (typeof value !== "string") return "";
  return value.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
}

/** An empty href is allowed (the row shows but links nowhere). A non-empty one must pass the same check as every other link on the site. */
export function isSafeShellHref(href: string): boolean {
  return href === "" || safeHref(href) === href;
}

const iconSchema = z.enum(SHELL_ICONS).catch("tag");
const hrefSchema = z.string().max(2048).transform((value) => value.trim());
const linkSchema = z.object({
  label: z.string().max(MAX_TEXT),
  href: hrefSchema,
  visible: z.boolean().catch(true),
  icon: iconSchema,
});
const contactSchema = z.object({
  kind: z.enum(CONTACT_KINDS).catch("email"),
  label: z.string().max(MAX_TEXT),
  value: z.string().max(MAX_TEXT),
  href: hrefSchema,
  visible: z.boolean().catch(true),
});
const topicSchema = z.object({ label: z.string().max(MAX_TEXT), topic: z.enum(SUPPORT_TOPICS) });

const trustSchema = z.object({ label: z.string().max(MAX_TEXT), tone: z.enum(TRUST_TONES).catch("pink") });
const stepSchema = z.object({ title: z.string().max(MAX_TEXT), text: z.string().max(MAX_ABOUT) });
const imageSchema = z.object({
  scope: z.enum(["category", "city", "state"]),
  slug: z.string().max(120),
  photo: z.string().max(2048),
  band: z.string().max(2048),
  bandPhone: z.string().max(2048),
});

/** The shape an admin saves. Every text field is cleaned before it is stored. */
export const shellConfigSchema = z
  .object({
    header: z.object({
      navLinks: z.array(linkSchema).max(MAX_LINKS),
      loginLabel: z.string().max(MAX_TEXT),
      postLabel: z.string().max(MAX_TEXT),
    }),
    footer: z.object({
      about: z.string().max(MAX_ABOUT),
      trust: z.array(z.string().max(MAX_TEXT)).max(6),
      quickLinks: z.array(linkSchema).max(MAX_LINKS),
      topCategories: z.array(linkSchema).max(MAX_LINKS),
      contacts: z.array(contactSchema).max(6),
      legal: z.array(linkSchema).max(MAX_LINKS),
      socials: z.array(linkSchema).max(MAX_LINKS),
      adultNotice: z.string().max(MAX_TEXT),
      copyright: z.string().max(MAX_TEXT),
    }),
    chat: z.object({
      title: z.string().max(MAX_TEXT),
      status: z.string().max(MAX_TEXT),
      welcome: z.string().max(MAX_TEXT),
      guestHint: z.string().max(MAX_TEXT),
      whatsapp: z.string().max(MAX_TEXT),
      telegram: z.string().max(MAX_TEXT),
      phone: z.string().max(MAX_TEXT),
      topics: z.array(topicSchema).max(6),
    }),
    home: z.object({ trust: z.array(trustSchema).max(5), steps: z.array(stepSchema).max(3) }).optional(),
    media: z.object({ images: z.array(imageSchema).max(200) }).optional(),
  })
  .strict();

/**
 * H7.4: an image URL is kept only when it is a site path or an https address with no characters that could
 * break out of a CSS url(). Anything else is dropped, so the page falls back to the gradient.
 */
export function isSafeImageUrl(value: string): boolean {
  if (value === "") return true;
  if (value.length > 2048 || /["'()\\\s<>]/.test(value)) return false;
  return (value.startsWith("/") && !value.startsWith("//")) || value.startsWith("https://");
}

/** Returns the names of the fields whose link is not safe to publish. Empty when everything is fine. */
export function unsafeShellLinks(config: ShellConfig): string[] {
  const groups: [string, { label: string; href: string }[]][] = [
    ["header.navLinks", config.header.navLinks],
    ["footer.quickLinks", config.footer.quickLinks],
    ["footer.topCategories", config.footer.topCategories],
    ["footer.legal", config.footer.legal],
    ["footer.socials", config.footer.socials],
    ["footer.contacts", config.footer.contacts],
  ];
  const bad: string[] = [];
  for (const [name, items] of groups) {
    for (const item of items) if (!isSafeShellHref(item.href)) bad.push(`${name}: ${item.label || "link"}`);
  }
  if (!isSafeShellHref(config.chat.whatsapp) || !isSafeShellHref(config.chat.telegram)) bad.push("chat: WhatsApp or Telegram link");
  return bad;
}

function pickText(value: unknown, fallback: string, max = MAX_TEXT) {
  if (typeof value !== "string") return fallback;
  return cleanShellText(value, max);
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
}

function pickLinks(value: unknown, fallback: ShellLink[]): ShellLink[] {
  if (!Array.isArray(value)) return fallback;
  return rows(value)
    .map((item) => ({
      label: cleanShellText(item.label),
      href: typeof item.href === "string" ? item.href.trim().slice(0, 2048) : "",
      visible: item.visible !== false,
      icon: (SHELL_ICONS as readonly string[]).includes(String(item.icon)) ? (item.icon as ShellIcon) : "tag",
    }))
    .filter((item) => item.label !== "" || item.href !== "");
}

function pickContacts(value: unknown): ShellContact[] {
  return rows(value)
    .map((item) => ({
      kind: (CONTACT_KINDS as readonly string[]).includes(String(item.kind)) ? (item.kind as ContactKind) : "email",
      label: cleanShellText(item.label),
      value: cleanShellText(item.value),
      href: typeof item.href === "string" ? item.href.trim().slice(0, 2048) : "",
      visible: item.visible !== false,
    }))
    .filter((item) => item.label !== "" || item.value !== "");
}

function pickTopics(value: unknown, fallback: ShellTopic[]): ShellTopic[] {
  if (!Array.isArray(value)) return fallback;
  const topics = rows(value)
    .filter((item) => (SUPPORT_TOPICS as readonly string[]).includes(String(item.topic)))
    .map((item) => ({ label: cleanShellText(item.label), topic: item.topic as SupportTopic }))
    .filter((item) => item.label !== "");
  return topics.length ? topics : fallback;
}

function pickTrust(value: unknown, fallback: TrustPill[]): TrustPill[] {
  if (!Array.isArray(value)) return fallback;
  const pills = rows(value)
    .map((item) => ({
      label: cleanShellText(item.label),
      tone: (TRUST_TONES as readonly string[]).includes(String(item.tone)) ? (item.tone as TrustTone) : "pink",
    }))
    .filter((item) => item.label !== "")
    .slice(0, 5);
  return pills.length ? pills : fallback;
}

function pickSteps(value: unknown, fallback: HowStep[]): HowStep[] {
  if (!Array.isArray(value)) return fallback;
  const steps = rows(value)
    .map((item) => ({ title: cleanShellText(item.title), text: cleanShellText(item.text, MAX_ABOUT) }))
    .filter((item) => item.title !== "")
    .slice(0, 3);
  return steps.length ? steps : fallback;
}

function safeImage(value: unknown): string {
  return typeof value === "string" && isSafeImageUrl(value.trim()) ? value.trim() : "";
}

function pickImages(value: unknown): ShellImage[] {
  return rows(value)
    .map((item) => ({
      scope: item.scope === "city" ? ("city" as const) : item.scope === "state" ? ("state" as const) : ("category" as const),
      slug: cleanShellText(item.slug, 120),
      photo: safeImage(item.photo),
      band: safeImage(item.band),
      bandPhone: safeImage(item.bandPhone),
    }))
    .filter((item) => item.slug !== "" && (item.photo || item.band || item.bandPhone));
}

/**
 * Reads whatever is stored and fills every gap from the defaults. Used on every page, so it never throws:
 * a broken stored value falls back to the default for that field.
 */
export function normaliseShellConfig(raw: unknown): ShellConfig {
  const base = defaultShellConfig();
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, Record<string, unknown> | undefined>;
  const header = data.header ?? {};
  const footer = data.footer ?? {};
  const chat = data.chat ?? {};
  const home = (data.home ?? {}) as Record<string, unknown>;
  const media = (data.media ?? {}) as Record<string, unknown>;
  return {
    header: {
      navLinks: pickLinks(header.navLinks, base.header.navLinks),
      loginLabel: pickText(header.loginLabel, base.header.loginLabel),
      postLabel: pickText(header.postLabel, base.header.postLabel),
    },
    footer: {
      about: pickText(footer.about, base.footer.about, MAX_ABOUT),
      trust: Array.isArray(footer.trust) ? footer.trust.map((t) => cleanShellText(t)).filter(Boolean).slice(0, 6) : base.footer.trust,
      quickLinks: pickLinks(footer.quickLinks, base.footer.quickLinks),
      topCategories: pickLinks(footer.topCategories, []),
      contacts: pickContacts(footer.contacts),
      legal: pickLinks(footer.legal, base.footer.legal),
      socials: pickLinks(footer.socials, []),
      adultNotice: pickText(footer.adultNotice, base.footer.adultNotice),
      copyright: pickText(footer.copyright, base.footer.copyright),
    },
    chat: {
      title: pickText(chat.title, base.chat.title),
      status: pickText(chat.status, base.chat.status),
      welcome: pickText(chat.welcome, base.chat.welcome),
      guestHint: pickText(chat.guestHint, base.chat.guestHint),
      whatsapp: pickText(chat.whatsapp, ""),
      telegram: pickText(chat.telegram, ""),
      phone: pickText(chat.phone, ""),
      topics: pickTopics(chat.topics, base.chat.topics),
    },
    home: {
      trust: pickTrust(home.trust, base.home.trust),
      steps: pickSteps(home.steps, base.home.steps),
    },
    media: { images: pickImages(media.images) },
  };
}
