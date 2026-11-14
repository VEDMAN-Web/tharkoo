// Tharkoo SEO regression check (CLI). Rules live in src/server/seo/audit-rules.ts,
// the crawl in src/server/seo/crawl.ts. Same options and output as the old .mjs.
//
// Usage (server must already be running):
//   BASE_URL=http://127.0.0.1:4317 npm run seo:check
// Options (env): SEO_UA=google|browser|both, SEO_LIMIT=N, SEO_OUT=dir (default .seo-check/)
// Exit code: 0 = no P0 failures, 1 = at least one P0 failure.
import { mkdirSync, writeFileSync } from "node:fs";
import { countIssues } from "../src/server/seo/audit-rules";
import { crawlSite, type AgentName } from "../src/server/seo/audit-run";

async function main() {
  const base = (process.env.BASE_URL || "http://127.0.0.1:4317").replace(/\/$/, "");
  const out = process.env.SEO_OUT || ".seo-check";
  const mode = process.env.SEO_UA || "both";
  const agents: AgentName[] = mode === "both" ? ["google", "browser"] : [mode as AgentName];

  const started = Date.now();
  const result = await crawlSite({ base, agents, limit: Number(process.env.SEO_LIMIT || 0) });
  const { rows, robotsIssues } = result;
  const p0rows = rows.filter((r) => r.p0.length);
  const p1rows = rows.filter((r) => r.p1.length);

  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/seo-check.json`, JSON.stringify({ base, urls: result.urls, rows, robotsIssues }, null, 2));
  const statusCounts = new Map<number, number>();
  for (const r of rows) statusCounts.set(r.status, (statusCounts.get(r.status) || 0) + 1);
  const md = [
    `# SEO check: ${new Date().toISOString()}`,
    `Base: ${base} · sitemap URLs: ${result.urls} · requests: ${rows.length} · agents: ${agents.join(", ")} · ${Math.round((Date.now() - started) / 1000)}s`,
    "",
    `## P0 (${p0rows.length} page-agent rows, ${robotsIssues.length} robots issues)`,
    ...robotsIssues.map((i) => `- ${i}`),
    ...countIssues(p0rows.map((r) => r.p0)).map(([k, v]) => `- ${k}: ${v}`),
    "",
    `## P1 (${p1rows.length} rows)`,
    ...countIssues(p1rows.map((r) => r.p1)).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## First 25 P0 rows",
    ...p0rows.slice(0, 25).map((r) => `- [${r.agent}] ${r.path} → ${r.p0.join("; ")}`),
    "",
    "## Status codes",
    ...[...statusCounts].map(([s, n]) => `- ${s}: ${n}`),
  ].join("\n");
  writeFileSync(`${out}/seo-check.md`, md + "\n");
  console.log(md);
  process.exit(p0rows.length || robotsIssues.length ? 1 : 0);
}

void main();
