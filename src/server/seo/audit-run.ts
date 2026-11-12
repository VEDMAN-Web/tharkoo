import { connectDb } from "@/lib/db";
import { MAX_AUDIT_ROWS, SeoAuditRun, type SeoAuditRowDoc } from "@/server/models/seo";
import { crawlSite, type CrawlOptions, type CrawlResult } from "@/server/seo/crawl";

export const KEEP_RUNS = 30;
export const RUN_CONCURRENCY = 2;
export const RUN_GAP_MS = 100;

/** Rows with issues first, then the rest, capped so one run document stays small. */
export function rowsForStorage(result: CrawlResult): SeoAuditRowDoc[] {
  const slim = (r: CrawlResult["rows"][number]): SeoAuditRowDoc => ({
    path: r.path,
    agent: r.agent,
    status: r.status,
    inSitemap: r.inSitemap,
    title: r.title.slice(0, 200),
    desc: r.desc.slice(0, 300),
    h1: (r.h1[0] ?? "").slice(0, 200),
    canonical: r.canonical.slice(0, 300),
    words: r.words,
    ld: r.ld,
    noindex: /noindex/i.test(r.robots) || /noindex/i.test(r.xRobots),
    p0: r.p0,
    p1: r.p1,
  });
  const bad = result.rows.filter((r) => r.p0.length || r.p1.length);
  const good = result.rows.filter((r) => !r.p0.length && !r.p1.length);
  return [...bad, ...good].slice(0, MAX_AUDIT_ROWS).map(slim);
}

export async function pruneRuns(keep = KEEP_RUNS) {
  const old = await SeoAuditRun.find().sort({ startedAt: -1 }).skip(keep).select("_id").lean();
  if (old.length === 0) return 0;
  await SeoAuditRun.deleteMany({ _id: { $in: old.map((row) => row._id) } });
  return old.length;
}

export async function runAudit(input: { base: string; triggeredBy: string } & Partial<CrawlOptions>) {
  const result = await crawlSite({
    agents: ["google"],
    concurrency: RUN_CONCURRENCY,
    gapMs: RUN_GAP_MS,
    ...input,
  });
  await connectDb();
  const saved = await SeoAuditRun.create({
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    base: result.base,
    counts: result.counts,
    robotsIssues: result.robotsIssues,
    rows: rowsForStorage(result),
    triggeredBy: input.triggeredBy,
  });
  await pruneRuns();
  return { id: String(saved._id), counts: result.counts };
}
