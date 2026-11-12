import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { normalizeOverride, overridesToCsv, parseCsv } from "@/app/admin/urls/override-rules";
import { urlFaqs, urlIntro } from "@/lib/seo/override";
import { UrlOverride } from "@/server/models";
import { applyOverrideCsv, deleteUrlOverride, getUrlOverride, planOverrideCsv, saveUrlOverride } from "@/server/urls/service";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

function resetDbCache() {
  const g = globalThis as { mongoose?: { conn: unknown; promise: unknown } };
  if (g.mongoose) {
    g.mongoose.conn = null;
    g.mongoose.promise = null;
  }
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  resetDbCache();
  await connectMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
  resetDbCache();
});
beforeEach(clearMemoryMongo);

describe("override validation", () => {
  it("cleans a good override and normalises the path", () => {
    const out = normalizeOverride({ path: "jobs/pune", title: " Jobs <b>in</b> Pune ", robots: "noindex", faq: [{ q: "Q?", a: "A." }, { q: "", a: "" }] });
    expect(out).toMatchObject({ ok: true, value: { path: "/jobs/pune/", title: "Jobs in Pune", noindex: true, faq: [{ q: "Q?", a: "A." }] } });
  });

  it("rejects forbidden terms, long text, bad canonical, bad image and bad robots", () => {
    const out = normalizeOverride({
      path: "/x/",
      title: "Cheap escort",
      description: "d".repeat(321),
      canonical: "javascript:alert(1)",
      ogImage: "http://insecure.example/x.png",
      robots: "maybe",
      faq: [{ q: "Only a question", a: "" }],
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(Object.keys(out.errors).sort()).toEqual(["canonical", "description", "faq", "ogImage", "robots", "title"]);
  });

  it("accepts a canonical on this site and refuses one elsewhere", () => {
    expect(normalizeOverride({ path: "/a/", canonical: "https://tharkoo.example/b/" }, "https://tharkoo.example").ok).toBe(true);
    expect(normalizeOverride({ path: "/a/", canonical: "https://other.example/b/" }, "https://tharkoo.example").ok).toBe(false);
  });

  it("limits the FAQ to 8 questions", () => {
    const faq = Array.from({ length: 9 }, (_, i) => ({ q: `Q${i}`, a: `A${i}` }));
    const out = normalizeOverride({ path: "/a/", faq });
    expect(out.ok).toBe(false);
  });

  it("reads quoted CSV and protects formula cells when exporting", () => {
    expect(parseCsv('path,title\r\n/a/,"Jobs, ""best"""\n')).toEqual([["path", "title"], ["/a/", 'Jobs, "best"']]);
    const csv = overridesToCsv([{ path: "/a/", title: "=1+1", description: "", h1: "", noindex: true }]);
    expect(csv.split("\r\n")[1]).toBe("/a/,'=1+1,,,noindex");
  });
});

describe("saving overrides", () => {
  it("stores intro and FAQ and exposes them to the pages", async () => {
    await saveUrlOverride({ path: "/jobs/pune/", title: "T", intro: "Hello intro", faq: [{ q: "Q?", a: "A." }] });
    expect(await urlIntro("/jobs/pune/", "fallback")).toBe("Hello intro");
    expect(await urlIntro("/other/", "fallback")).toBe("fallback");
    expect(await urlFaqs("/jobs/pune/")).toEqual([{ q: "Q?", a: "A." }]);
  });

  it("keeps intro and FAQ when a later save does not send them", async () => {
    await saveUrlOverride({ path: "/jobs/pune/", intro: "Keep me", faq: [{ q: "Q?", a: "A." }] });
    await saveUrlOverride({ path: "/jobs/pune/", title: "New title" });
    const stored = await getUrlOverride("/jobs/pune/");
    expect(stored?.title).toBe("New title");
    expect(stored?.intro).toBe("Keep me");
    expect(stored?.faq).toHaveLength(1);
  });

  it("refuses a bad save with field messages and deletes on request", async () => {
    await expect(saveUrlOverride({ path: "/a/", title: "Cheap escort" })).rejects.toMatchObject({ fields: { title: expect.any(Array) } });
    await saveUrlOverride({ path: "/a/", title: "Fine title here" });
    const out = await deleteUrlOverride("/a/");
    expect(out.before?.title).toBe("Fine title here");
    expect(await UrlOverride.countDocuments()).toBe(0);
  });
});

describe("bulk CSV", () => {
  it("dry-runs new, changed, same and error rows without writing", async () => {
    await saveUrlOverride({ path: "/old/", title: "Old title", description: "Old description", noindex: false });
    await saveUrlOverride({ path: "/same/", title: "Same title" });
    const csv = [
      "path,title,robots",
      "/old/,New title,noindex",
      "/same/,Same title,index",
      "/fresh/,Fresh title,",
      "/bad/,Cheap escort,",
    ].join("\n");
    const plan = await planOverrideCsv(csv);
    const by = Object.fromEntries(plan.rows.map((row) => [row.path, row]));
    expect(by["/old/"].status).toBe("changed");
    expect(by["/old/"].changes).toEqual(['title: "Old title" -> "New title"', "robots: index -> noindex"]);
    expect(by["/same/"].status).toBe("same");
    expect(by["/fresh/"].status).toBe("new");
    expect(by["/bad/"].status).toBe("error");
    expect(plan.ready.map((row) => row.path)).toEqual(["/old/", "/fresh/"]);
    expect(await UrlOverride.countDocuments()).toBe(2);
    expect((await getUrlOverride("/old/"))?.title).toBe("Old title");
  });

  it("only touches the columns in the file", async () => {
    await saveUrlOverride({ path: "/old/", title: "Keep title", description: "Old description", intro: "Keep intro" });
    await applyOverrideCsv("path,description\n/old/,New description here");
    const stored = await getUrlOverride("/old/");
    expect(stored).toMatchObject({ title: "Keep title", description: "New description here", intro: "Keep intro" });
  });

  it("applies all-or-nothing", async () => {
    await expect(applyOverrideCsv("path,title\n/ok/,Fine title\n/bad/,Cheap escort")).rejects.toThrow(/nothing was imported/);
    expect(await UrlOverride.countDocuments()).toBe(0);
    const out = await applyOverrideCsv("path,title\n/ok/,Fine title\n/two/,Another title");
    expect(out).toEqual({ applied: 2, unchanged: 0 });
  });

  it("rejects a file without a path column and a duplicate path", async () => {
    expect((await planOverrideCsv("title\nNo path")).fileErrors[0]).toMatch(/path column/);
    const dup = await planOverrideCsv("path,title\n/a/,One title\n/a/,Two title");
    expect(dup.rows.map((row) => row.status)).toEqual(["new", "error"]);
  });

  it("refuses more than 500 rows", async () => {
    const rows = Array.from({ length: 501 }, (_, i) => `/p${i}/,T${i}`).join("\n");
    expect((await planOverrideCsv(`path,title\n${rows}`)).fileErrors[0]).toMatch(/500/);
  });
});
