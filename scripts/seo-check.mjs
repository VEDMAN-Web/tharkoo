#!/usr/bin/env node
// Tharkoo SEO regression check. Crawls every URL in the sitemap index plus a few
// fixed probes, then checks the on-page SEO rules in docs/claude/SEO_PLAN.md.
//
// Usage (server must already be running):
//   BASE_URL=http://127.0.0.1:4317 node scripts/seo-check.mjs
// Options (env):
//   SEO_UA=google|browser|both   which user agent(s) to test (default both)
//   SEO_LIMIT=N                  max sitemap URLs to check (default all)
//   SEO_OUT=dir                  where to write seo-check.json and seo-check.md (default .seo-check/)
// Exit code: 0 = no P0 failures, 1 = at least one P0 failure.
// Start the server with SITE_RATE_MAX=100000 so the crawl is not rate limited.

import { mkdirSync, writeFileSync } from "node:fs";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:4317").replace(/\/$/, "");
const LIMIT = Number(process.env.SEO_LIMIT || 0);
const OUT = process.env.SEO_OUT || ".seo-check";
const UA = {
  google: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  browser: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
};
const uaMode = process.env.SEO_UA || "both";
const agents = uaMode === "both" ? ["google", "browser"] : [uaMode];

const PROBES = [
  "/",
  "/cities/",
  "/categories/",
  "/search/?q=flat",
  "/this-page-does-not-exist/",
];

const decode = (s) =>
  s.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const strip = (s) => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const pick = (re, s) => (s.match(re) || [])[1] || "";

async function get(path, agent) {
  const url = path.startsWith("http") ? path : BASE + path;
  const r = await fetch(url, { redirect: "manual", headers: { "user-agent": UA[agent] } });
  return { status: r.status, location: r.headers.get("location") || "", xRobots: r.headers.get("x-robots-tag") || "", html: await r.text() };
}

function locs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

function analyse(path, res) {
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
    path, status: res.status, location: res.location, xRobots: res.xRobots,
    titleHead, titleInBodyOnly: !titleHead && !!titleAny, title: titleHead || titleAny,
    desc, canonical: canonical.replace(BASE, ""), robots, h1, words, ld, imgs: imgs.length, imgNoAlt,
  };
}

function issues(row, inSitemap) {
  const p0 = [];
  const p1 = [];
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

const started = Date.now();
const idx = await get("/sitemap.xml", "google");
const shards = locs(idx.html);
let urls = [];
for (const shard of shards) {
  const x = await get(shard.replace(BASE, ""), "google");
  urls.push(...locs(x.html).map((u) => u.replace(BASE, "")));
}
urls = [...new Set(urls)];
if (LIMIT) urls = urls.slice(0, LIMIT);
const robotsTxt = (await get("/robots.txt", "google")).html;

const rows = [];
for (const agent of agents) {
  for (const path of [...urls, ...PROBES]) {
    const res = await get(path, agent);
    const row = analyse(path, res);
    row.agent = agent;
    row.inSitemap = urls.includes(path);
    Object.assign(row, issues(row, row.inSitemap));
    rows.push(row);
  }
}

// duplicates (per agent, indexable 200 pages only)
for (const agent of agents) {
  const live = rows.filter((r) => r.agent === agent && r.status === 200 && !/noindex/i.test(r.robots));
  for (const key of ["title", "desc"]) {
    const seen = new Map();
    for (const r of live) if (r[key]) seen.set(r[key], [...(seen.get(r[key]) || []), r]);
    for (const [, list] of seen) if (list.length > 1) for (const r of list) r.p0.push(`duplicate ${key} (${list.length} pages)`);
  }
  const h1s = new Map();
  for (const r of live) if (r.h1[0]) h1s.set(r.h1[0], [...(h1s.get(r.h1[0]) || []), r]);
  for (const [, list] of h1s) if (list.length > 1) for (const r of list) r.p1.push(`duplicate h1 (${list.length} pages)`);
}

// robots.txt: every group must carry the private-path disallows
const robotsIssues = [];
const groups = robotsTxt.split(/\n(?=User-Agent:)/i).filter((g) => /User-Agent:/i.test(g));
for (const g of groups) {
  const ua = pick(/User-Agent:\s*(.*)/i, g).trim();
  for (const p of ["/u/", "/admin/", "/api/"]) if (!new RegExp(`Disallow:\\s*${p.replace(/\//g, "\\/")}`, "i").test(g)) robotsIssues.push(`robots.txt group '${ua}' does not disallow ${p}`);
}

const p0rows = rows.filter((r) => r.p0.length);
const p1rows = rows.filter((r) => r.p1.length);
const count = (list) => {
  const m = new Map();
  for (const r of list) for (const i of r) m.set(i.replace(/\d+/g, "N"), (m.get(i.replace(/\d+/g, "N")) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/seo-check.json`, JSON.stringify({ base: BASE, urls: urls.length, rows, robotsIssues }, null, 2));
const md = [
  `# SEO check — ${new Date().toISOString()}`,
  `Base: ${BASE} · sitemap URLs: ${urls.length} · requests: ${rows.length} · agents: ${agents.join(", ")} · ${Math.round((Date.now() - started) / 1000)}s`,
  "",
  `## P0 (${p0rows.length} page-agent rows, ${robotsIssues.length} robots issues)`,
  ...robotsIssues.map((i) => `- ${i}`),
  ...count(p0rows.map((r) => r.p0)).map(([k, v]) => `- ${k}: ${v}`),
  "",
  `## P1 (${p1rows.length} rows)`,
  ...count(p1rows.map((r) => r.p1)).map(([k, v]) => `- ${k}: ${v}`),
  "",
  "## First 25 P0 rows",
  ...p0rows.slice(0, 25).map((r) => `- [${r.agent}] ${r.path} → ${r.p0.join("; ")}`),
  "",
  "## Status codes",
  ...[...new Map(rows.map((r) => [r.status, rows.filter((x) => x.status === r.status).length]))].map(([s, n]) => `- ${s}: ${n}`),
].join("\n");
writeFileSync(`${OUT}/seo-check.md`, md + "\n");
console.log(md);
process.exit(p0rows.length || robotsIssues.length ? 1 : 0);
