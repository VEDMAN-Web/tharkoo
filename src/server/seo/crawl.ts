import {
  addDuplicateIssues,
  analyse,
  issues,
  locs,
  robotsIssues as checkRobots,
  summarise,
  type AuditCounts,
  type AuditRow,
  type FetchedPage,
} from "@/server/seo/audit-rules";

export const AGENTS = {
  google: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  browser: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
} as const;
export type AgentName = keyof typeof AGENTS;

export const PROBES = ["/", "/cities/", "/categories/", "/search/?q=flat", "/this-page-does-not-exist/"];
export const MAX_CRAWL_URLS = 5000;

export type PageFetcher = (path: string, agent: AgentName) => Promise<FetchedPage>;

export interface CrawlOptions {
  base: string;
  agents?: AgentName[];
  /** Max sitemap URLs (0 = default cap of 5,000). */
  limit?: number;
  concurrency?: number;
  gapMs?: number;
  fetcher?: PageFetcher;
}

export interface CrawlResult {
  base: string;
  urls: number;
  rows: AuditRow[];
  robotsIssues: string[];
  counts: AuditCounts;
  startedAt: Date;
  finishedAt: Date;
}

export function httpFetcher(base: string): PageFetcher {
  return async (path, agent) => {
    const url = path.startsWith("http") ? path : base + path;
    const r = await fetch(url, { redirect: "manual", headers: { "user-agent": AGENTS[agent] } });
    return {
      status: r.status,
      location: r.headers.get("location") || "",
      xRobots: r.headers.get("x-robots-tag") || "",
      html: await r.text(),
    };
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs `work` over `items` with at most `size` in flight, keeping input order in the result. */
async function pool<T, R>(items: T[], size: number, gapMs: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await work(items[i]);
      if (gapMs > 0) await sleep(gapMs);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, size) }, lane));
  return out;
}

export async function crawlSite(options: CrawlOptions): Promise<CrawlResult> {
  const base = options.base.replace(/\/$/, "");
  const agents = options.agents?.length ? options.agents : (["google", "browser"] as AgentName[]);
  const fetcher = options.fetcher ?? httpFetcher(base);
  const cap = options.limit && options.limit > 0 ? Math.min(options.limit, MAX_CRAWL_URLS) : MAX_CRAWL_URLS;
  const startedAt = new Date();

  const index = await fetcher("/sitemap.xml", "google");
  let urls: string[] = [];
  for (const shard of locs(index.html)) {
    const xml = await fetcher(shard.replace(base, ""), "google");
    urls.push(...locs(xml.html).map((u) => u.replace(base, "")));
  }
  urls = [...new Set(urls)].slice(0, cap);
  const inSitemap = new Set(urls);
  const robotsTxt = (await fetcher("/robots.txt", "google")).html;

  const jobs = agents.flatMap((agent) => [...urls, ...PROBES].map((path) => ({ agent, path })));
  const rows = await pool(jobs, options.concurrency ?? 1, options.gapMs ?? 0, async ({ agent, path }) => {
    const analysed = analyse(path, await fetcher(path, agent), base);
    const listed = inSitemap.has(path);
    return { ...analysed, agent, inSitemap: listed, ...issues(analysed, listed) } satisfies AuditRow;
  });

  addDuplicateIssues(rows);
  const robotsIssues = checkRobots(robotsTxt);
  return {
    base,
    urls: urls.length,
    rows,
    robotsIssues,
    counts: summarise(rows, urls.length, robotsIssues),
    startedAt,
    finishedAt: new Date(),
  };
}
