import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanQuery, searchAdmin, SEARCH_MAX } from "@/server/admin/search";
import { BlogPost, Listing, Page, Payment, User } from "@/server/models";
import { SupportTicket } from "@/server/models/support";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  const owner = new mongoose.Types.ObjectId();
  await Listing.collection.insertOne({ title: "Maths tutoring in Pune", slug: "maths-tutoring-pune-1", status: "active", ownerId: owner, updatedAt: new Date() });
  await User.collection.insertOne({ email: "maths.fan@example.test", displayName: "Maths Fan", roles: ["user"], status: "active", createdAt: new Date(), updatedAt: new Date() });
  await SupportTicket.collection.insertOne({ number: 4821, subject: "Maths tutoring refund question", status: "open", ownerKind: "user", lastMessageAt: new Date(), createdAt: new Date(), updatedAt: new Date() });
  await Payment.collection.insertOne({ userId: owner, orderId: owner, idempotencyKey: "k1", provider: "razorpay", providerRef: "pay_MATHS123", amount: 500, currency: "INR", status: "paid", updatedAt: new Date() });
  await Page.collection.insertOne({ title: "Maths safety page", slug: "maths-safety" });
  await BlogPost.collection.insertOne({ title: "Maths blog post", slug: "maths-blog" });
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

const keys = async (roles: string[], q = "maths") => (await searchAdmin(roles, q)).map((group) => group.key);

describe("the query (A49)", () => {
  it("needs two characters, is trimmed and cut", () => {
    expect(cleanQuery("m")).toBe("");
    expect(cleanQuery("  ma  ")).toBe("ma");
    expect(cleanQuery("a".repeat(500))).toHaveLength(SEARCH_MAX);
    expect(cleanQuery(undefined)).toBe("");
    expect(cleanQuery(42)).toBe("");
  });

  it("finds nothing for a short query, and treats special characters as plain text", async () => {
    expect(await searchAdmin(["admin"], "m")).toEqual([]);
    expect(await searchAdmin(["admin"], ".*(")).toEqual([]);
  });
});

describe("what each role sees (A49)", () => {
  it("an admin sees ads, users, tickets and pages, but the Orders rows are finance only", async () => {
    expect(await keys(["admin"])).toEqual(["ads", "users", "tickets", "pages"]);
    expect(await keys(["superadmin"], "pay_MATHS")).toEqual(["orders"]);
  });

  it("support sees ads, users and tickets, and never the finance-only Orders group", async () => {
    const found = await keys(["support"]);
    expect(found).toContain("tickets");
    expect(found).not.toContain("orders");
    expect(found).not.toContain("pages");
    const text = JSON.stringify(await searchAdmin(["support"], "pay_MATHS"));
    expect(text).not.toContain("pay_MATHS123");
  });

  it("finance sees the orders row and not tickets", async () => {
    const groups = await searchAdmin(["finance"], "pay_MATHS");
    expect(groups.map((group) => group.key)).toEqual(["orders"]);
    expect(groups[0].items[0]).toMatchObject({ title: "pay_MATHS123", href: "/admin/finance/?q=pay_MATHS123" });
    expect(await keys(["finance"])).not.toContain("tickets");
  });

  it("a moderator sees ads and users only; an SEO editor sees pages and content only", async () => {
    expect(await keys(["moderator"])).toEqual(["ads", "users"]);
    const seo = await searchAdmin(["seo_editor"], "maths");
    expect(seo.map((group) => group.key)).toEqual(["pages"]);
    expect(seo[0].items.map((item) => item.sub).sort()).toEqual(["Blog post", "Page"]);
  });

  it("a user with no staff role gets nothing from the data groups", async () => {
    expect(await searchAdmin(["user"], "maths")).toEqual([]);
  });
});

describe("the rows (A49)", () => {
  it("each row says what it is and opens the right screen", async () => {
    const groups = await searchAdmin(["admin"], "maths");
    const by = Object.fromEntries(groups.map((group) => [group.key, group.items[0]]));
    expect(by.ads.href).toMatch(/^\/admin\/ads\/[a-f0-9]{24}\/$/);
    expect(by.users).toMatchObject({ title: "Maths Fan", sub: "maths.f@\u2026" });
    expect(by.users.href).toMatch(/^\/admin\/users\/\?open=[a-f0-9]{24}$/);
    expect(by.tickets).toMatchObject({ sub: "#4821 · open" });
    expect(by.tickets.href).toMatch(/^\/admin\/support\/[a-f0-9]{24}\/$/);
  });

  it("finds a ticket by its number and a screen by its name, only if the role can open it", async () => {
    expect((await searchAdmin(["support"], "#4821"))[0]).toMatchObject({ key: "tickets" });
    const goto = await searchAdmin(["finance"], "Orders");
    expect(goto.find((group) => group.key === "screens")?.items.map((item) => item.title)).toContain("Orders & credits");
    const none = await searchAdmin(["moderator"], "Orders");
    expect(none.find((group) => group.key === "screens")).toBeUndefined();
  });
});
