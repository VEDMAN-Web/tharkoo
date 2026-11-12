import { describe, expect, it } from "vitest";
import {
  addDuplicateIssues,
  analyse,
  countIssues,
  issues,
  locs,
  robotsIssues,
  summarise,
  type AuditRow,
} from "@/server/seo/audit-rules";

const BASE = "http://x.test";
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
const page = (head: string, body = `<h1>Pune office jobs</h1><p>${words(200)}</p>`) => ({
  status: 200,
  location: "",
  xRobots: "",
  html: `<html><head>${head}</head><body>${body}</body></html>`,
});
const GOOD_HEAD =
  '<title>Office jobs in Pune | Tharkoo listings</title><meta name="description" content="Browse verified office jobs in Pune with phone numbers, pay details and posting dates, updated daily by the team."><link rel="canonical" href="http://x.test/jobs/pune/">';

function run(path: string, res: ReturnType<typeof page>, inSitemap = true) {
  const a = analyse(path, res, BASE);
  return { a, ...issues(a, inSitemap) };
}

describe("seo rules", () => {
  it("passes a clean page", () => {
    const { p0, p1 } = run("/jobs/pune/", page(GOOD_HEAD));
    expect(p0).toEqual([]);
    expect(p1).toEqual([]);
  });

  it("flags a missing title, description and canonical as P0", () => {
    const { p0 } = run("/x/", page(""));
    expect(p0).toEqual(expect.arrayContaining(["no <title>", "no canonical in <head>", "no meta description in <head>"]));
  });

  it("flags a title that only appears in the body (streamed)", () => {
    const { p0 } = run("/x/", page("", "<title>Late</title><h1>A</h1>"));
    expect(p0).toContain("title only in <body> (streamed)");
  });

  it("flags zero or two h1 tags", () => {
    expect(run("/x/", page(GOOD_HEAD, "<p>none</p>")).p0).toContain("0 h1 tags");
    expect(run("/x/", page(GOOD_HEAD, "<h1>a</h1><h1>b</h1>")).p0).toContain("2 h1 tags");
  });

  it("flags noindex pages that are in the sitemap", () => {
    const head = `${GOOD_HEAD}<meta name="robots" content="noindex,follow">`;
    expect(run("/x/", page(head), true).p0).toContain("noindex page listed in sitemap");
    expect(run("/x/", page(head), false).p0).not.toContain("noindex page listed in sitemap");
  });

  it("flags a sitemap URL that does not return 200 and stops there", () => {
    const res = { status: 404, location: "", xRobots: "", html: "" };
    expect(run("/gone/", res).p0).toEqual(["sitemap URL returns 404"]);
  });

  it("warns (P1) on canonical elsewhere, lengths, missing alt and thin content", () => {
    const head =
      '<title>Short</title><meta name="description" content="short"><link rel="canonical" href="http://x.test/other/">';
    const { p0, p1 } = run("/x/", page(head, '<h1>One</h1><img src="a.png"><p>few words</p>'));
    expect(p0).toEqual([]);
    expect(p1).toEqual(
      expect.arrayContaining([
        "canonical points elsewhere: /other/",
        "title length 5",
        "description length 5",
        "1 images without alt",
        expect.stringMatching(/^thin: /),
      ]),
    );
  });

  it("flags an h1 that repeats itself", () => {
    const body = `<h1>Office jobs in Pune Office jobs in Pune</h1><p>${words(200)}</p>`;
    expect(run("/x/", page(GOOD_HEAD, body)).p1).toContain("h1 text repeats itself");
  });

  it("adds duplicate title/description as P0 and duplicate h1 as P1, per agent, ignoring noindex", () => {
    const mk = (path: string, agent: string, robots = ""): AuditRow => {
      const head = GOOD_HEAD + (robots ? `<meta name="robots" content="${robots}">` : "");
      return { ...analyse(path, page(head), BASE), agent, inSitemap: true, p0: [], p1: [] };
    };
    const rows = [mk("/a/", "google"), mk("/b/", "google"), mk("/c/", "google", "noindex"), mk("/a/", "browser")];
    addDuplicateIssues(rows);
    expect(rows[0].p0).toEqual(["duplicate title (2 pages)", "duplicate desc (2 pages)"]);
    expect(rows[1].p1).toEqual(["duplicate h1 (2 pages)"]);
    expect(rows[2].p0).toEqual([]);
    expect(rows[3].p0).toEqual([]);
  });

  it("requires the private-path disallows in every robots group", () => {
    const ok = "User-Agent: *\nDisallow: /u/\nDisallow: /admin/\nDisallow: /api/\n";
    expect(robotsIssues(ok)).toEqual([]);
    const bad = `${ok}\nUser-Agent: GPTBot\nDisallow: /u/\n`;
    expect(robotsIssues(bad)).toEqual([
      "robots.txt group 'GPTBot' does not disallow /admin/",
      "robots.txt group 'GPTBot' does not disallow /api/",
    ]);
  });

  it("reads sitemap locs, folds digits when counting and summarises rows", () => {
    expect(locs("<loc> http://x.test/a </loc><loc>http://x.test/b</loc>")).toEqual(["http://x.test/a", "http://x.test/b"]);
    expect(countIssues([["3 h1 tags"], ["2 h1 tags", "no <title>"]])).toEqual([
      ["N hN tags", 2],
      ["no <title>", 1],
    ]);
    const rows = [{ p0: ["a"], p1: [] }, { p0: [], p1: ["b"] }, { p0: [], p1: [] }] as unknown as AuditRow[];
    expect(summarise(rows, 2, ["r"])).toEqual({ urls: 2, sitemapUrls: 2, requests: 3, p0Rows: 1, p1Rows: 1, robotsIssues: 1 });
  });
});
