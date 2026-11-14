import { z } from "zod";
import { safeHref } from "@/lib/sanitize";
import { SUPPORT_TOPICS, type SupportTopic } from "@/server/support/constants";

/**
 * H7.1: every line of text, link and contact detail in the new header, footer and support chat.
 * These are the defaults; the stored value overrides them field by field. Pure, so client and server share it.
 */

export const SHELL_ICONS = ["home", "grid", "pin", "book", "help", "mail", "info", "shield", "user", "tag"] as const;
export type ShellIcon = (typeof SHELL_ICONS)[number];

export const CONTACT_KINDS = ["email", "phone", "whatsapp", "hours", "address"] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

export type ShellLink = { label: string; href: string; visible: boolean; icon: ShellIcon };
export type ShellContact = { kind: ContactKind; label: string; value: string; href: string; visible: boolean };
export type ShellTopic = { label: string; topic: SupportTopic };

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
        link("About us", "/cms/about/", "info"),
        link("Contact", "/contact/", "mail"),
      ],
      topCategories: [],
      contacts: [],
      legal: [
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
  })
  .strict();

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
  };
}
