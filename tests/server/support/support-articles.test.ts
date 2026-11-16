import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/support-articles/route";
import { HelpArticle } from "@/server/models";
import { suggestSupportArticles } from "@/server/support/articles";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

beforeAll(async () => {
  await connectMemoryMongo();
});

beforeEach(async () => {
  await clearMemoryMongo();
  await HelpArticle.create([
    { slug: "post-an-ad", title: "How to post an ad", section: "Posting an ad", body: "Create, edit and renew your listing.", order: 1 },
    { slug: "buy-credits", title: "Buying credits and payments", section: "Payments", body: "Pay with UPI. Refunds go back to the wallet.", order: 2 },
    { slug: "stay-safe", title: "Spot a scam", section: "Safety", body: "Report a fake ad.", order: 3 },
    { slug: "draft", title: "Post draft", section: "Posting an ad", body: "Not published.", status: "draft", order: 4 },
  ]);
});

afterAll(async () => {
  await disconnectMemoryMongo();
});

describe("suggestSupportArticles", () => {
  it("returns matching published articles, best first, at most three", async () => {
    const found = await suggestSupportArticles("my_ads", "Help with my ad");
    expect(found.map((item) => item.slug)).toEqual(["post-an-ad", "stay-safe"]);
    expect(found.length).toBeLessThanOrEqual(3);
  });

  it("matches payments questions to the payments article", async () => {
    const found = await suggestSupportArticles("coins_payments", "Credits and payments");
    expect(found[0]?.slug).toBe("buy-credits");
  });

  it("never returns a draft and returns nothing for an unmatched question", async () => {
    expect((await suggestSupportArticles("my_ads", "")).map((item) => item.slug)).not.toContain("draft");
    expect(await suggestSupportArticles("something_else", "zzzz qqqq")).toEqual([]);
  });

  it("serves the suggestions over GET without a session", async () => {
    const res = await GET(new Request("http://localhost/api/support-articles?topic=report_problem&q=Report%20a%20problem"));
    const body = (await res.json()) as { ok: boolean; data: { slug: string }[] };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data[0].slug).toBe("stay-safe");
  });

  it("rejects an unknown topic", async () => {
    const res = await GET(new Request("http://localhost/api/support-articles?topic=nope"));
    expect(res.status).toBe(400);
  });
});
