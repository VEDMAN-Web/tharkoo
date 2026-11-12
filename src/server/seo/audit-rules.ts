// Pure SEO rules. No network, no database. Used by the crawler (audit-run.ts),
// the CLI wrapper (scripts/seo-check.ts) and the admin SEO screens.

export interface FetchedPage {
  status: number;
  location: string;
  xRobots: string;
  html: string;
}

export interface AuditRow {
  path: string;
  status: number;
  location: string;
  xRobots: string;
  titleHead: string;
  titleInBodyOnly: boolean;
  title: string;
  desc: string;
  canonical: string;
  robots: string;
  h1: string[];
  words: number;
  ld: string[];
  imgs: number;
  imgNoAlt: number;
  agent: string;
  inSitemap: boolean;
  p0: string[];
  p1: string[];
}

export type AnalysedPage = Omit<AuditRow, "agent" | "inSitemap" | "p0" | "p1">;

export const PRIVATE_PATHS = ["/u/", "/admin/", "/api/"] as const;

export function decode(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export function strip(s: string) {
  return decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function pick(re: RegExp, s: string) {
  return (s.match(re) || [])[1] || "";
}

export function locs(xml: string) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

export function analyse(path: string, res: FetchedPage, base: string): AnalysedPage {
  const html = res.html;
  const cut = html.indexOf("</head>");
  const head = cut >= 0 ? html.slice(0, cut) : "";
  const body = (cut >= 0 ? html.slice(cut) : html).replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
  const titleHead = decode(pick(/<title>([^<]*)<\/title>/, head));
  const titleAny = decode(pick(/<title>([^<]*)<\/title>/, html));
  const desc = decode(pick(/<meta name="description" content="([^"]*)"/, head));
  const canonical = pick(/<link rel="canonical" href="([^"]*)"/, head);
  const robots = pick(/<meta name="robots" content="([^"]*)"/, head);
  const h1 = [...body.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => strip(m[1]));
  const words = strip(body).split(" ").filter(Boolean).length;
  const ld = [...new Set([...html.matchAll(/"@type":"([A-Za-z]+)"/g)].map((m) => m[1]))];
  const imgs = [...body.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  const imgNoAlt = imgs.filter((t) => !/\balt="[^"]+"/.test(t) && !/aria-hidden="true"/.test(t) && !/\balt=""/.test(t)).length;
  return {
    path,
    status: res.status,
    location: res.location,
    xRobots: res.xRobots,
    titleHead,
    titleInBodyOnly: !titleHead && !!titleAny,
    title: titleHead || titleAny,
    desc,
    canonical: base ? canonical.replace(base, "") : canonical,
    robots,
    h1,
    words,
    ld,
    imgs: imgs.length,
    imgNoAlt,
  };
}

export function issues(row: AnalysedPage, inSitemap: boolean) {
  const p0: string[] = [];
  const p1: string[] = [];
  const noindex = /noindex/i.test(row.robots) || /noindex/i.test(row.xRobots);
  if (inSitemap && row.status !== 200) p0.push(`sitemap URL returns ${row.status}`);
  if (row.status !== 200) return { p0, p1 };
  if (inSitemap && noindex) p0.push("noindex page listed in sitemap");
  if (!row.titleHead) p0.push(row.titleInBodyOnly ? "title only in <body> (streamed)" : "no <title>");
  if (!row.canonical && !noindex) p0.push("no canonical in <head>");
  if (row.canonical && !noindex && row.canonical !== row.path.split("?")[0]) p1.push(`canonical points elsewhere: ${row.canonical}`);
  if (!row.desc) p0.push("no meta description in <head>");
  if (row.h1.length !== 1) p0.push(`${row.h1.length} h1 tags`);
  if (row.h1.length === 1 && /(.{12,})\1/.test(row.h1[0].replace(/\s/g, ""))) p1.push("h1 text repeats itself");
  const t = row.title.length;
  if (t && (t < 30 || t > 65)) p1.push(`title length ${t}`);
  const d = row.desc.length;
  if (d && (d < 70 || d > 160)) p1.push(`description length ${d}`);
  if (row.imgNoAlt) p1.push(`${row.imgNoAlt} images without alt`);
  if (!noindex && row.words < 150) p1.push(`thin: ${row.words} words`);
  return { p0, p1 };
}

/** Adds duplicate title/description (P0) and duplicate h1 (P1) to rows, per agent. Mutates the rows it is given. */
export function addDuplicateIssues(rows: AuditRow[]) {
  const agents = [...new Set(rows.map((r) => r.agent))];
  for (const agent of agents) {
    const live = rows.filter((r) => r.agent === agent && r.status === 200 && !/noindex/i.test(r.robots));
    for (const key of ["title", "desc"] as const) {
      const seen = new Map<string, AuditRow[]>();
      for (const r of live) if (r[key]) seen.set(r[key], [...(seen.get(r[key]) || []), r]);
      for (const list of seen.values()) if (list.length > 1) for (const r of list) r.p0.push(`duplicate ${key} (${list.length} pages)`);
    }
    const h1s = new Map<string, AuditRow[]>();
    for (const r of live) if (r.h1[0]) h1s.set(r.h1[0], [...(h1s.get(r.h1[0]) || []), r]);
    for (const list of h1s.values()) if (list.length > 1) for (const r of list) r.p1.push(`duplicate h1 (${list.length} pages)`);
  }
}

/** Every robots.txt group must carry the private-path disallows. */
export function robotsIssues(robotsTxt: string) {
  const out: string[] = [];
  const groups = robotsTxt.split(/\n(?=User-Agent:)/i).filter((g) => /User-Agent:/i.test(g));
  for (const g of groups) {
    const ua = pick(/User-Agent:\s*(.*)/i, g).trim();
    for (const p of PRIVATE_PATHS) {
      if (!new RegExp(`Disallow:\\s*${p.replace(/\//g, "\\/")}`, "i").test(g)) out.push(`robots.txt group '${ua}' does not disallow ${p}`);
    }
  }
  return out;
}

/** Groups issue texts (digits folded to N) with counts, biggest first. */
export function countIssues(lists: string[][]) {
  const m = new Map<string, number>();
  for (const list of lists) {
    for (const i of list) {
      const key = i.replace(/\d+/g, "N");
      m.set(key, (m.get(key) || 0) + 1);
    }
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export interface AuditCounts {
  urls: number;
  /** All URLs found in the sitemap (urls may be capped lower). */
  sitemapUrls?: number;
  requests: number;
  p0Rows: number;
  p1Rows: number;
  robotsIssues: number;
}

export function summarise(rows: AuditRow[], urls: number, robots: string[], sitemapUrls = urls): AuditCounts {
  return {
    urls,
    sitemapUrls,
    requests: rows.length,
    p0Rows: rows.filter((r) => r.p0.length).length,
    p1Rows: rows.filter((r) => r.p1.length).length,
    robotsIssues: robots.length,
  };
}
