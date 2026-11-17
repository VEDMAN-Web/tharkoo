import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { kpiTexts, waitText } from "@/app/admin/finance/_orders/orders-format";
import { getReceipt, listOrders, orderKpis, parseOrderQuery, receiptNo } from "@/server/admin/orders";
import { ForbiddenError, NotFoundError } from "@/server/http";
import { Payment, PromotionOrder, PromotionProduct, User, WalletEntry } from "@/server/models";
import { Withdrawal } from "@/server/wallet/withdrawals";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const NOW = new Date("2026-11-17T10:00:00.000Z");
const HOUR = 3_600_000;
const finance = ["finance"];

async function person(email: string, name: string) {
  return User.create({ email, passwordHash: "x", displayName: name, roles: ["user"], verificationStatus: "unsubmitted", status: "active", dateOfBirth: new Date("1995-04-02"), attestedAdultAt: new Date("2020-01-01") });
}

let orderId = 0;
async function payment(userId: mongoose.Types.ObjectId, extra: Record<string, unknown>) {
  orderId += 1;
  const doc = new Payment({ userId, orderId: new mongoose.Types.ObjectId(), idempotencyKey: `k-${orderId}`, amount: 1000, currency: "INR", status: "paid", method: "card", credits: 100, provider: "real", ...extra });
  await doc.save();
  return doc;
}

async function seed() {
  const rohan = await person("rohan@example.com", "Rohan Mehta");
  const priya = await person("priya@example.com", "Priya Shah");
  const real = await payment(rohan._id, { amount: 4250, credits: 575, createdAt: new Date(NOW.getTime() - 2 * HOUR), updatedAt: new Date(NOW.getTime() - 2 * HOUR) });
  const test = await payment(priya._id, { provider: "mock", amount: 1900, credits: 210, createdAt: new Date(NOW.getTime() - 3 * HOUR), updatedAt: new Date(NOW.getTime() - 3 * HOUR) });
  const stuck = await payment(rohan._id, { status: "pending", method: "crypto", coin: "USDT", network: "TRC-20", amount: 2700, credits: 330, expiresAt: new Date(NOW.getTime() + HOUR), createdAt: new Date(NOW.getTime() - 4 * HOUR) });
  const failed = await payment(priya._id, { status: "failed", outcome: "cancelled", createdAt: new Date(NOW.getTime() - 40 * 24 * HOUR) });
  return { rohan, priya, real, test, stuck, failed };
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});

const query = (params: Record<string, string> = {}) => parseOrderQuery(params);

describe("the address", () => {
  it("reads the tab, range, status and page size, with safe defaults for anything else", () => {
    expect(query()).toMatchObject({ tab: "recharges", range: "30", status: "", hideTest: false, page: 1, pageSize: 25, q: "" });
    expect(query({ tab: "wallet", range: "7", status: "paid", test: "hide", page: "3", size: "50", q: "  tk-1  " })).toMatchObject({ tab: "wallet", range: "7", status: "paid", hideTest: true, page: 3, pageSize: 50, q: "tk-1" });
    expect(query({ tab: "nope", range: "x", status: "weird", page: "-4", size: "7" })).toMatchObject({ tab: "recharges", range: "30", status: "", page: 1, pageSize: 25 });
  });
});

describe("the four numbers", () => {
  it("real sales never include a test order; test orders are counted apart; recharges to check skip test and fresh ones", async () => {
    await seed();
    const kpis = await orderKpis(NOW);
    expect(kpis.realSales).toEqual({ rupees: 4250, orders: 1 });
    expect(kpis.testOrders).toEqual({ count: 1, rupees: 1900 });
    expect(kpis.toCheck.count).toBe(1);
    expect(kpis.toCheck.oldestMinutes).toBe(240);
    const texts = kpiTexts(kpis);
    expect(texts.sales).toEqual({ value: "₹4,250", hint: "1 order" });
    expect(texts.test).toEqual({ value: "1", hint: "₹1,900, left out of sales" });
    expect(texts.check).toEqual({ value: "1", hint: "Oldest 4 h" });
  });

  it("counts payouts that wait for approval and says when nothing waits", async () => {
    expect(kpiTexts(await orderKpis(NOW)).payouts).toEqual({ value: "0", hint: "Nothing waiting" });
    const user = await person("vendor@example.com", "Vendor");
    await Withdrawal.collection.insertOne({ userId: user._id, status: "requested", coins: 100, amountInr: 6200, createdAt: NOW });
    const kpis = await orderKpis(NOW);
    expect(kpis.payouts).toEqual({ count: 1, rupees: 6200 });
    expect(kpiTexts(kpis).payouts.hint).toBe("₹6,200 asked for");
  });

  it("formats waiting times", () => {
    expect(waitText(41)).toBe("41 min");
    expect(waitText(240)).toBe("4 h");
    expect(waitText(2 * 24 * 60)).toBe("2 days");
    expect(waitText(24 * 60)).toBe("1 day");
  });
});

describe("recharges", () => {
  it("lists newest first, flags TEST for provider mock, shows waiting time, and links the receipt", async () => {
    const data = await seed();
    const list = await listOrders(query({ range: "all" }), finance, NOW);
    expect(list.total).toBe(4);
    expect(list.rows.map((row) => row.ref)).toEqual([data.real, data.test, data.stuck, data.failed].map((doc) => receiptNo(String(doc._id))));
    const test = list.rows.find((row) => row.id === String(data.test._id));
    expect(test).toMatchObject({ test: true, statusText: "Paid", amount: "₹1,900", who: "Priya Shah", sub: "210 credits · card" });
    expect(list.rows.find((row) => row.id === String(data.real._id))?.test).toBe(false);
    expect(list.rows.find((row) => row.id === String(data.stuck._id))).toMatchObject({ statusText: "Waiting 4 h", statusTone: "warn", sub: "330 credits · crypto" });
    expect(list.rows.find((row) => row.id === String(data.failed._id))?.statusText).toBe("Cancelled");
    expect(test?.receipt).toBe(`/admin/finance/receipt/${data.test._id}/`);
    expect(test?.details.find(([label]) => label === "Payment")?.[1]).toContain("Test payment");
  });

  it("filters by period, status, hide test, and finds an order by its number, exact email or name start", async () => {
    const data = await seed();
    expect((await listOrders(query({ range: "30" }), finance, NOW)).total).toBe(3);
    expect((await listOrders(query({ range: "all", status: "paid" }), finance, NOW)).total).toBe(2);
    expect((await listOrders(query({ range: "all", test: "hide" }), finance, NOW)).rows.every((row) => !row.test)).toBe(true);
    expect((await listOrders(query({ range: "all", q: receiptNo(String(data.real._id)) }), finance, NOW)).rows.map((row) => row.id)).toEqual([String(data.real._id)]);
    expect((await listOrders(query({ range: "all", q: "priya@example.com" }), finance, NOW)).total).toBe(2);
    expect((await listOrders(query({ range: "all", q: "Roh" }), finance, NOW)).total).toBe(2);
    expect((await listOrders(query({ range: "all", q: "nobody@example.com" }), finance, NOW)).total).toBe(0);
  });

  it("pages the rows", async () => {
    await seed();
    const page = await listOrders(query({ range: "all", size: "25" }), finance, NOW);
    expect(page.rows.length).toBe(4);
    const second = await listOrders({ ...query({ range: "all" }), pageSize: 3, page: 2 }, finance, NOW);
    expect(second.rows.length).toBe(1);
    expect(second.total).toBe(4);
  });
});

describe("the other tabs", () => {
  it("shows posting fees, refunds and wallet changes from the ledger, and promotions with their plan", async () => {
    const data = await seed();
    const at = new Date(NOW.getTime() - HOUR);
    await WalletEntry.collection.insertMany([
      { userId: data.rohan._id, delta: -30, reason: "debit", refType: "listing_fee", refId: "ad1:1", balanceAfter: 545, idempotencyKey: "i1", createdAt: at },
      { userId: data.rohan._id, delta: 30, reason: "refund", refType: "listing_fee_refund", refId: "ad1:1", balanceAfter: 575, idempotencyKey: "i2", createdAt: at },
      { userId: data.priya._id, delta: 50, reason: "refund", refType: "refund", refId: `${data.test._id}#50#abc`, balanceAfter: 260, idempotencyKey: "i3", createdAt: at },
    ]);
    const fees = await listOrders(query({ tab: "fees" }), finance, NOW);
    expect(fees.total).toBe(2);
    expect(fees.rows.map((row) => row.ref).sort()).toEqual(["Posting fee", "Posting fee given back"]);
    expect(fees.rows.find((row) => row.ref === "Posting fee")).toMatchObject({ amount: "-30 credits", who: "Rohan Mehta", statusText: "Credits used" });
    const refunds = await listOrders(query({ tab: "refunds" }), finance, NOW);
    expect(refunds.rows).toHaveLength(1);
    expect(refunds.rows[0]).toMatchObject({ ref: "Refund", amount: "+50 credits", sub: receiptNo(String(data.test._id)), receipt: `/admin/finance/receipt/${data.test._id}/` });
    expect((await listOrders(query({ tab: "wallet" }), finance, NOW)).total).toBe(3);

    const product = await PromotionProduct.create({ code: "top", name: "TOP", description: "Top", amount: 499, currency: "INR", durationDays: 7 });
    await PromotionOrder.create({ userId: data.rohan._id, listingId: new mongoose.Types.ObjectId(), productId: product._id, status: "active", durationDays: 7, startsAt: new Date(NOW.getTime() - HOUR), endsAt: new Date(NOW.getTime() + HOUR), createdAt: at });
    const promotions = await listOrders(query({ tab: "promotions" }), finance, NOW);
    expect(promotions.rows[0]).toMatchObject({ ref: "TOP", statusText: "Live", amount: "499 credits", who: "Rohan Mehta" });
  });
});

describe("receipts and access", () => {
  it("builds a receipt that says TEST for a test payment, and refuses unknown or non-recharge ids", async () => {
    const data = await seed();
    const receipt = await getReceipt(String(data.test._id), finance);
    expect(receipt).toMatchObject({ no: receiptNo(String(data.test._id)), test: true, amount: "₹1,900", credits: 210, user: "Priya Shah", method: "Card", status: "paid" });
    expect((await getReceipt(String(data.stuck._id), ["admin"])).method).toBe("Crypto, USDT TRC-20");
    await expect(getReceipt("0123456789abcdef01234567", finance)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getReceipt("not-an-id", finance)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("only finance and admins may look", async () => {
    const data = await seed();
    for (const roles of [["support"], ["moderator"], ["user"], []]) {
      await expect(listOrders(query(), roles, NOW)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(getReceipt(String(data.real._id), roles)).rejects.toBeInstanceOf(ForbiddenError);
    }
    await expect(listOrders(query(), ["admin"], NOW)).resolves.toBeTruthy();
  });
});
