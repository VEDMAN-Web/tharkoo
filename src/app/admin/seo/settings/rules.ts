// Pure rules for the robots / llms.txt / structured data settings. No database here.
import { AD_SCHEMA_MAPPINGS, type AdSchemaMapping } from "@/lib/seo/schema";
import { textDenied } from "@/server/shared/policy";

export const MAX_ROBOTS_LINES = 30;
export const MAX_LLMS_SECTIONS = 5;
export const LLMS_LIMITS = { intro: 600, sectionTitle: 60, sectionBody: 1500 } as const;
export const MAX_SAME_AS = 8;

export interface LlmsSection {
  title: string;
  body: string;
}

export interface OrgSettings {
  name: string;
  logo: string;
  sameAs: string[];
  email: string;
  phone: string;
}

export interface SeoSettings {
  /** Extra `Disallow` paths appended to the rule for all crawlers. */
  robotsDisallow: string[];
  llmsIntro: string;
  llmsSections: LlmsSection[];
  organization: OrgSettings;
  /** Category slug to schema type. A missing category uses the built-in choice. */
  adSchema: Record<string, AdSchemaMapping>;
  defaultOgImage: string;
}

export const DEFAULT_SEO_SETTINGS: SeoSettings = {
  robotsDisallow: [],
  llmsIntro: "",
  llmsSections: [],
  organization: { name: "", logo: "", sameAs: [], email: "", phone: "" },
  adSchema: {},
  defaultOgImage: "",
};

/** Paths that must stay crawlable: the sitemap files, the build output and the robots file itself. */
const PROTECTED = ["/sitemap.xml", "/sitemap/", "/_next/", "/robots.txt", "/llms.txt"];
const ROBOTS_CHARS = /^[A-Za-z0-9/_\-.%~*$?=&]+$/;

/** Returns a plain-English problem with one Disallow line, or null when it is fine. */
export function robotsLineProblem(raw: string): string | null {
  const line = raw.trim();
  if (!line) return "Empty line";
  if (!line.startsWith("/")) return "Start the path with /";
  if (line.length > 120) return "Keep it under 120 characters";
  if (!ROBOTS_CHARS.test(line)) return "Use only letters, numbers and / _ - . % ~ * $ ? = &";
  const prefix = line.split(/[*$]/)[0];
  if (prefix === "/") return "This would block the whole site";
  for (const path of PROTECTED) {
    if (path.startsWith(prefix) || (path.endsWith("/") && prefix.startsWith(path))) {
      return `This would block ${path}, which search engines need`;
    }
  }
  return null;
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/<[^>]*>/g, "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max) : "";
}

function httpsList(value: unknown) {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\r?\n/) : [];
  return [...new Set(raw.map((item) => String(item).trim()).filter(Boolean))];
}

/** Lenient read for stored data: anything unusable is dropped. */
export function normaliseSeoSettings(raw: unknown): SeoSettings {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const org = (source.organization && typeof source.organization === "object" ? source.organization : {}) as Record<string, unknown>;
  const sections = Array.isArray(source.llmsSections) ? source.llmsSections : [];
  const adSchema: Record<string, AdSchemaMapping> = {};
  for (const [slug, value] of Object.entries((source.adSchema && typeof source.adSchema === "object" ? source.adSchema : {}) as Record<string, unknown>)) {
    if (/^[a-z0-9-]{1,80}$/.test(slug) && AD_SCHEMA_MAPPINGS.includes(value as AdSchemaMapping)) adSchema[slug] = value as AdSchemaMapping;
  }
  return {
    robotsDisallow: httpsList(source.robotsDisallow).filter((line) => robotsLineProblem(line) === null).slice(0, MAX_ROBOTS_LINES),
    llmsIntro: text(source.llmsIntro, LLMS_LIMITS.intro),
    llmsSections: sections
      .map((item) => ({ title: text((item as LlmsSection)?.title, LLMS_LIMITS.sectionTitle), body: text((item as LlmsSection)?.body, LLMS_LIMITS.sectionBody) }))
      .filter((item) => item.title && item.body)
      .slice(0, MAX_LLMS_SECTIONS),
    organization: {
      name: text(org.name, 120),
      logo: text(org.logo, 500),
      sameAs: httpsList(org.sameAs).filter((href) => /^https:\/\/\S+$/.test(href)).slice(0, MAX_SAME_AS),
      email: text(org.email, 120),
      phone: text(org.phone, 40),
    },
    adSchema,
    defaultOgImage: text(source.defaultOgImage, 500),
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function imageProblem(value: string) {
  if (!value) return null;
  if (/\s/.test(value)) return "Use an image from the media library or an https address";
  if (value.startsWith("/") && !value.startsWith("//")) return null;
  return /^https:\/\/\S+$/.test(value) ? null : "Use an image from the media library or an https address";
}

/** Strict version for saving; returns the clean settings or the problems by field. */
export function validateSeoSettings(raw: unknown): { ok: true; value: SeoSettings } | { ok: false; errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {};
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const lines = httpsList(source.robotsDisallow);
  if (lines.length > MAX_ROBOTS_LINES) errors.robotsDisallow = [`At most ${MAX_ROBOTS_LINES} lines`];
  else {
    const bad = lines.map((line) => ({ line, problem: robotsLineProblem(line) })).find((row) => row.problem);
    if (bad) errors.robotsDisallow = [`${bad.line}: ${bad.problem}`];
  }

  const intro = typeof source.llmsIntro === "string" ? source.llmsIntro : "";
  if (intro.length > LLMS_LIMITS.intro) errors.llmsIntro = [`Keep this to ${LLMS_LIMITS.intro} characters or fewer`];
  else if (intro && textDenied(intro).denied) errors.llmsIntro = ["This text contains a word that is not allowed on Tharkoo"];
  const sections = Array.isArray(source.llmsSections) ? (source.llmsSections as LlmsSection[]) : [];
  if (sections.length > MAX_LLMS_SECTIONS) errors.llmsSections = [`At most ${MAX_LLMS_SECTIONS} sections`];
  for (const item of sections) {
    const title = String(item?.title ?? "");
    const body = String(item?.body ?? "");
    if ((title || body) && (!title.trim() || !body.trim())) errors.llmsSections = ["Each section needs a title and a text"];
    else if (title.length > LLMS_LIMITS.sectionTitle || body.length > LLMS_LIMITS.sectionBody) errors.llmsSections = ["A section is too long"];
    else if (textDenied(title).denied || textDenied(body).denied) errors.llmsSections = ["A section contains a word that is not allowed on Tharkoo"];
  }

  const org = (source.organization && typeof source.organization === "object" ? source.organization : {}) as Record<string, unknown>;
  const sameAs = httpsList(org.sameAs);
  if (sameAs.length > MAX_SAME_AS || sameAs.some((href) => !/^https:\/\/\S+$/.test(href))) errors["organization.sameAs"] = [`Up to ${MAX_SAME_AS} https addresses, one per line`];
  const email = String(org.email ?? "").trim();
  if (email && !EMAIL.test(email)) errors["organization.email"] = ["Enter a valid email address"];
  const logoProblem = imageProblem(String(org.logo ?? "").trim());
  if (logoProblem) errors["organization.logo"] = [logoProblem];
  const ogProblem = imageProblem(String(source.defaultOgImage ?? "").trim());
  if (ogProblem) errors.defaultOgImage = [ogProblem];
  const nameText = String(org.name ?? "");
  if (nameText && textDenied(nameText).denied) errors["organization.name"] = ["This text contains a word that is not allowed on Tharkoo"];

  const mapping = (source.adSchema && typeof source.adSchema === "object" ? source.adSchema : {}) as Record<string, unknown>;
  for (const [slug, value] of Object.entries(mapping)) {
    if (!/^[a-z0-9-]{1,80}$/.test(slug) || !AD_SCHEMA_MAPPINGS.includes(value as AdSchemaMapping)) errors.adSchema = ["Choose JobPosting, Product or none"];
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: normaliseSeoSettings(raw) };
}

/** The llms.txt lines for the SEO-center intro and sections (empty when none are set). */
export function llmsExtra(settings: SeoSettings): { intro: string | null; sections: string[] } {
  const sections = settings.llmsSections.flatMap((item) => ["", `## ${item.title}`, item.body]);
  return { intro: settings.llmsIntro || null, sections };
}
