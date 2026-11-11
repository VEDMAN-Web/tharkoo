export const DEFAULT_PATHS = {
  ad: "ad",
  tag: "tag",
  search: "search",
  blog: "blog",
  help: "help",
  cities: "cities",
  cms: "cms",
  contact: "contact",
  postAd: "u/post-insert",
  login: "u/login",
  register: "u/register",
  submitReport: "submit-report",
} as const;

export type PathKey = keyof typeof DEFAULT_PATHS;
export type UrlPaths = Record<PathKey, string>;

export const PATH_KEYS = Object.keys(DEFAULT_PATHS) as PathKey[];

const RESERVED = new Set([
  "admin",
  "api",
  "u",
  "search",
  "ad",
  "blog",
  "help",
  "cms",
  "cities",
  "contact",
  "sitemap",
  "robots",
  "uploads",
  "login",
  "register",
  "post-ad",
  "tag",
  "cookies",
  "privacy",
  "terms",
  "scam-report",
  "submit-report",
  "styleguide",
  "maintenance",
  "gone",
  "grievance",
  "about",
  "manifest",
  "brand",
  "placeholders",
]);

const BLOCKED_PREFIX = new Set(["admin", "api", "uploads", "sitemap", "robots", "brand", "placeholders", "_next"]);

export function cleanPath(input: string) {
  const bare = input.split("?")[0]?.split("#")[0] || "/";
  const withSlash = bare.startsWith("/") ? bare : `/${bare}`;
  const collapsed = withSlash.replace(/\/{2,}/g, "/");
  if (collapsed === "/") return "/";
  return collapsed.endsWith("/") ? collapsed : `${collapsed}/`;
}

export function normalizeSlug(input: string) {
  const slug = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug;
}

export function reservedSlugs(paths: UrlPaths = DEFAULT_PATHS) {
  const set = new Set(RESERVED);
  for (const value of Object.values(paths)) {
    for (const part of value.split("/")) if (part) set.add(part);
  }
  return set;
}

export function validateSlug(input: string, paths: UrlPaths = DEFAULT_PATHS) {
  const slug = normalizeSlug(input);
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { ok: false as const, message: "Use lowercase letters, numbers, and hyphens." };
  }
  if (reservedSlugs(paths).has(slug)) return { ok: false as const, message: "That slug is reserved." };
  return { ok: true as const, slug };
}

export function validatePrefix(input: string) {
  const value = input.trim().replace(/^\/+|\/+$/g, "").toLowerCase();
  const parts = value.split("/");
  if (!value || parts.length > 3 || parts.some((part) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(part))) {
    return { ok: false as const, message: "Use lowercase words separated by hyphens, with at most two slashes." };
  }
  if (parts.some((part) => BLOCKED_PREFIX.has(part))) return { ok: false as const, message: "That prefix is reserved." };
  return { ok: true as const, prefix: value };
}

export function readPaths(raw: unknown): UrlPaths {
  const paths: UrlPaths = { ...DEFAULT_PATHS };
  if (!raw || typeof raw !== "object") return paths;
  const record = raw as Record<string, unknown>;
  for (const key of PATH_KEYS) {
    const value = record[key];
    if (typeof value !== "string") continue;
    const parsed = validatePrefix(value);
    if (parsed.ok) paths[key] = parsed.prefix;
  }
  return paths;
}

export function joinPath(...parts: Array<string | undefined>) {
  const body = parts
    .flatMap((part) => (part || "").split("/"))
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
  return cleanPath(`/${body}`);
}

export function categoriesPath() {
  return "/categories/";
}

export function safetyPath() {
  return "/safety/";
}

export function howItWorksPath() {
  return "/how-it-works/";
}

export function prohibitedPath() {
  return "/prohibited-items/";
}

export function categoryPath(category: string) {
  return joinPath(category);
}

export function placePath(category: string, place: string, district?: string) {
  return joinPath(category, place, district);
}

export function tagPath(paths: UrlPaths, category: string, tag: string) {
  return joinPath(category, paths.tag, tag);
}

export function adPath(paths: UrlPaths, slug: string) {
  return joinPath(paths.ad, slug);
}

export function blogPath(paths: UrlPaths, slug?: string) {
  return joinPath(paths.blog, slug);
}

export function helpPath(paths: UrlPaths, slug?: string) {
  return joinPath(paths.help, slug);
}

export function cmsPath(paths: UrlPaths, slug?: string) {
  return joinPath(paths.cms, slug);
}

export function searchPath(paths: UrlPaths) {
  return joinPath(paths.search);
}

export function citiesPath(paths: UrlPaths) {
  return joinPath(paths.cities);
}

export function contactPath(paths: UrlPaths) {
  return joinPath(paths.contact);
}

export function postAdPath(paths: UrlPaths) {
  return joinPath(paths.postAd);
}

export function loginPath(paths: UrlPaths) {
  return joinPath(paths.login);
}

export function registerPath(paths: UrlPaths) {
  return joinPath(paths.register);
}

export function reportPath(paths: UrlPaths) {
  return joinPath(paths.submitReport);
}

export function applyPrefixes(href: string, paths: UrlPaths) {
  if (!href.startsWith("/")) return href;
  const [path, query] = href.split("?");
  for (const key of PATH_KEYS) {
    const from = joinPath(DEFAULT_PATHS[key]);
    const to = joinPath(paths[key]);
    if (from === to) continue;
    if (path === from.slice(0, -1) || path === from || path?.startsWith(from)) {
      const next = `${to}${path.slice(from.length)}`;
      return query ? `${next}?${query}` : next;
    }
  }
  return href;
}

export function splitAdSlug(slug: string) {
  const match = slug.match(/^(.*)-([a-z0-9]{4,})$/);
  if (!match?.[1] || !match[2]) return { title: slug, id: "" };
  return { title: match[1], id: match[2] };
}

export function joinAdSlug(title: string, id: string) {
  const base = normalizeSlug(title);
  if (!id) return base;
  return `${base}-${id}`;
}

export type RedirectRule = { id: string; from: string; to: string };

export type PathDecision =
  | { action: "next" }
  | { action: "redirect"; to: string; id?: string }
  | { action: "rewrite"; to: string };

function segments(path: string) {
  return cleanPath(path).split("/").filter(Boolean);
}

function applyPrefix(pathname: string, from: string, to: string) {
  const base = cleanPath(`/${from}`);
  const next = cleanPath(`/${to}`);
  const path = cleanPath(pathname);
  if (path === base) return next;
  const prefix = base === "/" ? "/" : base;
  if (!path.startsWith(prefix)) return null;
  return cleanPath(`${next}${path.slice(prefix.length)}`);
}

export function matchRule(pathname: string, rule: RedirectRule) {
  const from = cleanPath(rule.from.replace(/\*$/, ""));
  const target = cleanPath(rule.to.replace(/\*$/, ""));
  if (rule.from.endsWith("*") || rule.to.endsWith("*")) {
    const path = cleanPath(pathname);
    if (path !== from && !path.startsWith(from)) return null;
    const rest = path.slice(from.length);
    return cleanPath(`${target}${rest}`);
  }
  return cleanPath(pathname) === cleanPath(rule.from) ? cleanPath(rule.to) : null;
}

function bare(value: string) {
  return cleanPath(value.replace(/\*$/, ""));
}

export function decidePath(pathname: string, paths: UrlPaths, rules: RedirectRule[]): PathDecision {
  const ordered = [...rules].sort((a, b) => bare(b.from).length - bare(a.from).length);
  let current = cleanPath(pathname);
  let id: string | undefined;
  const seen = new Set<string>();
  for (let hop = 0; hop < 6; hop += 1) {
    if (seen.has(current)) return { action: "next" };
    seen.add(current);
    let stepped = false;
    for (const rule of ordered) {
      const next = matchRule(current, rule);
      if (!next || next === current) continue;
      current = next;
      id = id || rule.id;
      stepped = true;
      break;
    }
    if (!stepped) break;
  }
  if (current !== cleanPath(pathname)) return { action: "redirect", to: current, id };

  for (const key of PATH_KEYS) {
    if (key === "tag") continue;
    const pub = paths[key];
    const internal = DEFAULT_PATHS[key];
    if (pub === internal) continue;
    const rewritten = applyPrefix(pathname, pub, internal);
    if (rewritten && rewritten !== cleanPath(pathname)) return { action: "rewrite", to: rewritten };
  }
  const parts = segments(pathname);
  if (parts.length >= 3 && parts[1] === paths.tag && paths.tag !== DEFAULT_PATHS.tag) {
    const copy = [...parts];
    copy[1] = DEFAULT_PATHS.tag;
    return { action: "rewrite", to: joinPath(...copy) };
  }
  return { action: "next" };
}

export function followTarget(from: string, to: string, rules: RedirectRule[]) {
  const wild = from.endsWith("*") || to.endsWith("*");
  const origin = bare(from);
  let current = bare(to);
  const seen = new Set<string>([origin]);
  for (let hop = 0; hop < 8; hop += 1) {
    if (seen.has(current)) throw new Error("That redirect would loop.");
    seen.add(current);
    const rule = rules.find((item) => bare(item.from) === current);
    if (!rule) return wild ? `${current}*` : current;
    const next = bare(rule.to);
    if (next === current) return wild ? `${current}*` : current;
    current = next;
  }
  throw new Error("That redirect would loop.");
}
