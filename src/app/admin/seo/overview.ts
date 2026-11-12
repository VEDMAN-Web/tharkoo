import { connectDb } from "@/lib/db";
import { siteUrl } from "@/lib/utils";
import { ConflictError } from "@/server/http";
import { Redirect } from "@/server/models/cms";
import { SeoAuditRun, type SeoAuditRowDoc, type SeoAuditRunDoc } from "@/server/models/seo";
import { runAudit } from "@/server/seo/audit-run";
import { assertSeoEditor, recordSeo, type SeoActor } from "@/app/admin/seo/staff";

export const RUN_COOLDOWN_MS = 10 * 60 * 1000;
/** A manual run crawls fewer URLs than the nightly one so it finishes inside a request. */
export const MANUAL_RUN_LIMIT = 300;
export const TREND_RUNS = 30;

export interface TrendPoint {
  id: string;
  at: string;
  p0Rows: number;
  p1Rows: number;
}

export interface OverviewKpis {
  urls: number;
  /** URLs the last run actually opened. */
  checked: number;
  indexable: number;
  p0Rows: number;
  p1Rows: number;
  thin: number;
  duplicates: number;
  robotsIssues: number;
  redirects: number;
}

export interface Overview {
  hasRun: boolean;
  lastRunAt: string | null;
  triggeredBy: string;
  base: string;
  kpis: OverviewKpis | null;
  trend: TrendPoint[];
  nextRunAllowedAt: string | null;
  /** True while the 10 minute cool-down after the last run is still running. */
  waiting: boolean;
}

type RunLean = Pick<SeoAuditRunDoc, "startedAt" | "counts" | "robotsIssues" | "rows" | "triggeredBy" | "base"> & { _id: unknown };

function agentRows(rows: SeoAuditRowDoc[]) {
  return rows.filter((row) => row.agent === "google");
}

export function kpisFrom(run: Pick<SeoAuditRunDoc, "counts" | "rows" | "robotsIssues">, redirects: number): OverviewKpis {
  const rows = agentRows(run.rows ?? []);
  const has = (row: SeoAuditRowDoc, text: string) => [...row.p0, ...row.p1].some((issue) => issue.includes(text));
  return {
    urls: run.counts?.sitemapUrls ?? run.counts?.urls ?? 0,
    checked: run.counts?.urls ?? 0,
    indexable: rows.filter((row) => row.status === 200 && !row.noindex).length,
    p0Rows: run.counts?.p0Rows ?? 0,
    p1Rows: run.counts?.p1Rows ?? 0,
    thin: rows.filter((row) => has(row, "thin:")).length,
    duplicates: rows.filter((row) => has(row, "duplicate title") || has(row, "duplicate desc")).length,
    robotsIssues: run.counts?.robotsIssues ?? 0,
    redirects,
  };
}

export async function loadOverview(): Promise<Overview> {
  await connectDb();
  const [runs, redirects] = await Promise.all([
    SeoAuditRun.find().sort({ startedAt: -1 }).limit(TREND_RUNS).lean<RunLean[]>(),
    Redirect.countDocuments({}),
  ]);
  const last = runs[0];
  const trend = [...runs].reverse().map((run) => ({
    id: String(run._id),
    at: new Date(run.startedAt).toISOString(),
    p0Rows: run.counts?.p0Rows ?? 0,
    p1Rows: run.counts?.p1Rows ?? 0,
  }));
  return {
    hasRun: Boolean(last),
    lastRunAt: last ? new Date(last.startedAt).toISOString() : null,
    triggeredBy: last?.triggeredBy ?? "",
    base: last?.base ?? siteUrl(),
    kpis: last ? kpisFrom(last, redirects) : null,
    trend,
    nextRunAllowedAt: last ? new Date(new Date(last.startedAt).getTime() + RUN_COOLDOWN_MS).toISOString() : null,
    waiting: last ? Date.now() - new Date(last.startedAt).getTime() < RUN_COOLDOWN_MS : false,
  };
}

export async function loadLastRunRows(): Promise<{ at: string | null; rows: SeoAuditRowDoc[] }> {
  await connectDb();
  const last = await SeoAuditRun.findOne().sort({ startedAt: -1 }).lean<RunLean>();
  return { at: last ? new Date(last.startedAt).toISOString() : null, rows: agentRows(last?.rows ?? []) };
}

/** Starts a crawl for staff. At most one run every 10 minutes, whoever starts it. */
export async function runNow(actor: SeoActor, now = new Date()) {
  assertSeoEditor(actor);
  await connectDb();
  const last = await SeoAuditRun.findOne().sort({ startedAt: -1 }).select("startedAt").lean<{ startedAt: Date }>();
  if (last && now.getTime() - new Date(last.startedAt).getTime() < RUN_COOLDOWN_MS) {
    const wait = Math.ceil((RUN_COOLDOWN_MS - (now.getTime() - new Date(last.startedAt).getTime())) / 60000);
    throw new ConflictError(`An SEO check ran recently. Try again in ${wait} minute${wait === 1 ? "" : "s"}.`);
  }
  const result = await runAudit({ base: siteUrl(), triggeredBy: actor.email || "staff", limit: MANUAL_RUN_LIMIT });
  await recordSeo(actor, "seo.audit.run", "seo-audit", result.id, {}, result.counts);
  return result;
}
