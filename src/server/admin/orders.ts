import mongoose, { type QueryFilter, type Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { can } from "@/lib/admin/perms";
import { RECHARGE_CHECK_AFTER_MS } from "@/server/admin/counts";
import { walletBalance } from "@/server/billing/ledger";
import { FEE_REFUND_REF, FEE_REF } from "@/server/billing/posting-fee";
import { RECHARGE_METHODS, statusOf } from "@/server/billing/recharge";
import { refundableCredits } from "@/server/billing/service";
import { actionsFor } from "@/server/admin/order-actions";
import { ForbiddenError, NotFoundError } from "@/server/http";
import { Listing, Payment, PromotionOrder, PromotionProduct, User, WalletEntry } from "@/server/models";
import { Withdrawal } from "@/server/wallet/withdrawals";

/** H8.22 (A22): Orders & credits, read only. A test payment (provider "mock") carries a TEST badge and is never counted as sales. */

export type OrderTab = "recharges" | "fees" | "promotions" | "refunds" | "payouts" | "wallet";
export const ORDER_TABS: readonly OrderTab[] = ["recharges", "fees", "promotions", "refunds", "payouts", "wallet"];
export const ORDER_PAGE_SIZES = [25, 50, 100] as const;
export type OrderRange = "7" | "30" | "all";

const DAY_MS = 24 * 60 * 60 * 1000;
const NAME_PREFIX_MIN = 2;
const MAX_NAME_MATCHES = 200;

export type OrderQuery = { tab: OrderTab; q: string; range: OrderRange; status: string; hideTest: boolean; page: number; pageSize: number; open: string };

export function parseOrderQuery(params: Record<string, string | string[] | undefined>): OrderQuery {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const tab = (ORDER_TABS as readonly string[]).includes(one("tab")) ? (one("tab") as OrderTab) : "recharges";
  const range = one("range") === "7" || one("range") === "all" ? (one("range") as OrderRange) : "30";
  const size = Number(one("size"));
  const page = Math.floor(Number(one("page")));
  const status = ["pending", "paid", "failed"].includes(one("status")) ? one("status") : "";
  return {
    tab,
    q: one("q").trim().slice(0, 120),
    range,
    status,
    hideTest: one("test") === "hide",
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    pageSize: (ORDER_PAGE_SIZES as readonly number[]).includes(size) ? size : 25,
    open: one("open").slice(0, 40),
  };
}

export type StatusTone = "ok" | "warn" | "bad" | "info" | "neutral";

export type OrderRow = {
  id: string;
  ref: string;
  sub: string;
  statusText: string;
  statusTone: StatusTone;
  /** A test payment: shown with a TEST badge and never counted as sales. */
  test: boolean;
  amount: string;
  who: string;
  at: string | null;
  /** The facts for the drawer, in order. */
  details: [string, string][];
  /** The receipt page of a recharge. */
  receipt: string | null;
  /** What staff may do to this recharge right now (H8.24). Null for rows that are not recharges, or when the viewer may not act. */
  act: null | { paymentId: string; credits: number; markPaid: boolean; markFailed: boolean; refund: boolean; refundable: number };
};

export type OrderKpis = {
  realSales: { rupees: number; orders: number };
  testOrders: { count: number; rupees: number };
  toCheck: { count: number; oldestMinutes: number | null };
  payouts: { count: number; rupees: number };
};

export type OrderList = { rows: OrderRow[]; total: number; query: OrderQuery; kpis: OrderKpis };

export const rupees = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;
export const receiptNo = (id: string) => `TK-${id.slice(-8).toUpperCase()}`;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sinceOf(range: OrderRange, now: Date): Date | null {
  return range === "all" ? null : new Date(now.getTime() - Number(range) * DAY_MS);
}

function requireView(roles: readonly string[]) {
  if (!can(roles, "orders.view")) throw new ForbiddenError("You do not have permission to do this");
}

/** Users whose email is exactly what was typed, or whose name starts with it. */
async function matchingUsers(q: string): Promise<Types.ObjectId[]> {
  if (q.includes("@")) {
    const row = await User.findOne({ email: q.toLowerCase() }).select("_id").lean<{ _id: Types.ObjectId } | null>();
    return row ? [row._id] : [];
  }
  if (q.length < NAME_PREFIX_MIN) return [];
  const rows = await User.find({ displayName: new RegExp(`^${escapeRegex(q)}`, "i") }).select("_id").limit(MAX_NAME_MATCHES).lean<{ _id: Types.ObjectId }[]>();
  return rows.map((row) => row._id);
}

/** The order number "TK-1A2B3C4D" is the last 8 characters of the payment id. */
function orderNumber(q: string): string | null {
  const match = /^tk-?([0-9a-f]{8})$/i.exec(q.trim());
  return match ? match[1].toLowerCase() : null;
}

async function names(ids: unknown[]): Promise<Map<string, { name: string; email: string }>> {
  const unique = [...new Set(ids.filter(Boolean).map(String))].filter((id) => mongoose.isValidObjectId(id));
  if (unique.length === 0) return new Map();
  const rows = await User.find({ _id: { $in: unique } }).select("displayName email").lean<{ _id: Types.ObjectId; displayName?: string; email?: string }[]>();
  return new Map(rows.map((row) => [String(row._id), { name: row.displayName || "Unknown", email: row.email ?? "" }]));
}

const when = (date: Date | undefined) => (date ? new Date(date).toISOString() : null);

/** The four numbers on top of the screen. Test orders are counted apart and are never added to the sales. */
export async function orderKpis(now: Date = new Date()): Promise<OrderKpis> {
  await connectDb();
  const start = new Date(now.getTime() - ((now.getTime() + 5.5 * 3600_000) % DAY_MS));
  const [paid, waiting, payouts] = await Promise.all([
    Payment.find({ status: "paid", method: { $in: [...RECHARGE_METHODS] }, updatedAt: { $gte: start } }).select("provider amount").lean<{ provider?: string; amount?: number }[]>(),
    Payment.find({ status: "pending", provider: { $ne: "mock" }, createdAt: { $lt: new Date(now.getTime() - RECHARGE_CHECK_AFTER_MS) } }).select("createdAt").lean<{ createdAt?: Date }[]>(),
    Withdrawal.find({ status: "requested" }).select("amountInr").lean<{ amountInr?: number }[]>(),
  ]);
  const realSales = { rupees: 0, orders: 0 };
  const testOrders = { count: 0, rupees: 0 };
  for (const row of paid) {
    if (row.provider === "mock") {
      testOrders.count += 1;
      testOrders.rupees += row.amount ?? 0;
    } else {
      realSales.orders += 1;
      realSales.rupees += row.amount ?? 0;
    }
  }
  const oldest = waiting.reduce((min, row) => (row.createdAt && (min === null || row.createdAt.getTime() < min) ? row.createdAt.getTime() : min), null as number | null);
  return {
    realSales,
    testOrders,
    toCheck: { count: waiting.length, oldestMinutes: oldest === null ? null : Math.max(0, Math.floor((now.getTime() - oldest) / 60_000)) },
    payouts: { count: payouts.length, rupees: payouts.reduce((sum, row) => sum + (row.amountInr ?? 0), 0) },
  };
}

type PaymentLean = { _id: Types.ObjectId; userId: unknown; amount: number; currency: string; status: "pending" | "paid" | "failed"; provider?: string; method?: "card" | "crypto"; coin?: string; network?: string; credits?: number; expiresAt?: Date; outcome?: string; createdAt?: Date };

async function rechargeRows(query: OrderQuery, skip: number, now: Date, canAct: boolean): Promise<{ rows: OrderRow[]; total: number }> {
  const filter: QueryFilter<Record<string, unknown>> = { method: { $in: [...RECHARGE_METHODS] } };
  const since = sinceOf(query.range, now);
  if (since) filter.createdAt = { $gte: since };
  if (query.status) filter.status = query.status;
  if (query.hideTest) filter.provider = { $ne: "mock" };
  if (query.q) {
    const number = orderNumber(query.q);
    if (number) filter.$expr = { $regexMatch: { input: { $toString: "$_id" }, regex: `${number}$`, options: "i" } };
    else filter.userId = { $in: await matchingUsers(query.q) };
  }
  const [docs, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(query.pageSize).lean<PaymentLean[]>(),
    Payment.countDocuments(filter),
  ]);
  const people = await names(docs.map((doc) => doc.userId));
  const rows = await Promise.all(
    docs.map(async (doc) => {
      const id = String(doc._id);
      const status = statusOf(doc as never, now.getTime());
      const person = people.get(String(doc.userId));
      const waitedMinutes = doc.createdAt ? Math.floor((now.getTime() - doc.createdAt.getTime()) / 60_000) : 0;
      const method = doc.method === "crypto" ? `crypto${doc.coin ? `, ${doc.coin}${doc.network ? ` ${doc.network}` : ""}` : ""}` : "card";
      const tone: StatusTone = status === "paid" ? "ok" : status === "pending" ? "warn" : "bad";
      const text = status === "pending" ? (waitedMinutes >= 60 ? `Waiting ${Math.floor(waitedMinutes / 60)} h` : `Waiting ${waitedMinutes} min`) : status === "paid" ? "Paid" : status === "cancelled" ? "Cancelled" : status === "expired" ? "Expired" : "Failed";
      const balance = person ? await walletBalance(String(doc.userId)) : null;
      const refundable = doc.status === "paid" && doc.provider !== "mock" ? await refundableCredits(doc) : 0;
      const may = canAct ? actionsFor({ status: doc.status, provider: doc.provider }, refundable) : null;
      return {
        id,
        ref: receiptNo(id),
        sub: `${(doc.credits ?? 0).toLocaleString("en-IN")} credits · ${doc.method === "crypto" ? "crypto" : "card"}`,
        statusText: text,
        statusTone: tone,
        test: doc.provider === "mock",
        amount: rupees(doc.amount),
        who: person?.name ?? "Unknown",
        at: when(doc.createdAt),
        details: [
          ["User", person ? `${person.name} (${person.email})${balance === null ? "" : `, ${balance.toLocaleString("en-IN")} credits now`}` : "Unknown"],
          ["Credits", `${(doc.credits ?? 0).toLocaleString("en-IN")}`],
          ["Amount", rupees(doc.amount)],
          ["Method", method],
          ["Status", text],
          ["Payment", doc.provider === "mock" ? "Test payment. No money was taken." : "Real payment"],
        ] as [string, string][],
        receipt: `/admin/finance/receipt/${id}/`,
        act: may && (may.markPaid || may.markFailed || may.refund) ? { paymentId: id, credits: doc.credits ?? 0, ...may, refundable } : null,
      };
    }),
  );
  return { rows, total };
}

type EntryLean = { _id: Types.ObjectId; userId: Types.ObjectId; delta: number; reason: string; refType: string; refId: string; balanceAfter: number; createdAt?: Date };

const REF_TITLES: Record<string, string> = {
  pack: "Recharge",
  pack_bonus: "Bonus credits",
  coupon: "Coupon credits",
  promotion: "Promotion",
  promotion_reversal: "Promotion cancelled",
  refund: "Refund",
  [FEE_REF]: "Posting fee",
  [FEE_REFUND_REF]: "Posting fee given back",
  staff_adjust: "Staff change",
  staff_adjust_undo: "Staff change undone",
  video_tour: "Video tour",
  coin_purchase: "Credit purchase",
  withdrawal: "Withdrawal",
  booking: "Booking",
};

function refTitle(refType: string) {
  if (REF_TITLES[refType]) return REF_TITLES[refType];
  const text = refType.replace(/[_-]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Credit change";
}

const AD_REF_TYPES = [FEE_REF, FEE_REFUND_REF];
const PROMOTION_REF_TYPES = ["promotion", "promotion_reversal"];
const HEX_ID = /^[0-9a-f]{24}$/i;

/** The ad each wallet line is about, by title: a posting fee points at the ad, a promotion at its order. */
async function adTitlesFor(docs: readonly EntryLean[]): Promise<Map<string, string>> {
  const head = (doc: EntryLean) => doc.refId.split(":")[0];
  const direct = docs.filter((doc) => AD_REF_TYPES.includes(doc.refType) && HEX_ID.test(head(doc))).map(head);
  const orderIds = docs.filter((doc) => PROMOTION_REF_TYPES.includes(doc.refType) && HEX_ID.test(head(doc))).map(head);
  const orders = orderIds.length ? await PromotionOrder.find({ _id: { $in: orderIds } }).select("listingId").lean<{ _id: Types.ObjectId; listingId: Types.ObjectId }[]>() : [];
  const adOfOrder = new Map(orders.map((order) => [String(order._id), String(order.listingId)]));
  const adIds = [...new Set([...direct, ...adOfOrder.values()])];
  const ads = adIds.length ? await Listing.find({ _id: { $in: adIds } }).select("title").lean<{ _id: Types.ObjectId; title?: string }[]>() : [];
  const titleOf = new Map(ads.map((ad) => [String(ad._id), ad.title || "Untitled"]));
  return new Map(
    docs.flatMap((doc) => {
      const adId = AD_REF_TYPES.includes(doc.refType) ? head(doc) : adOfOrder.get(head(doc));
      const title = adId ? titleOf.get(adId) : undefined;
      return title ? [[String(doc._id), title] as const] : [];
    }),
  );
}

async function entryRows(query: OrderQuery, skip: number, now: Date, refTypes: string[] | null): Promise<{ rows: OrderRow[]; total: number }> {
  const filter: QueryFilter<Record<string, unknown>> = refTypes ? { refType: { $in: refTypes } } : {};
  const since = sinceOf(query.range, now);
  if (since) filter.createdAt = { $gte: since };
  if (query.q) filter.userId = { $in: await matchingUsers(query.q) };
  const [docs, total] = await Promise.all([
    WalletEntry.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(query.pageSize).lean<EntryLean[]>(),
    WalletEntry.countDocuments(filter),
  ]);
  const [people, adTitles] = await Promise.all([names(docs.map((doc) => doc.userId)), adTitlesFor(docs)]);
  const rows: OrderRow[] = docs.map((doc) => {
    const person = people.get(String(doc.userId));
    const adTitle = adTitles.get(String(doc._id));
    const sign = `${doc.delta > 0 ? "+" : doc.delta < 0 ? "-" : ""}${Math.abs(doc.delta).toLocaleString("en-IN")}`;
    const paymentId = doc.refType === "refund" ? doc.refId.split("#")[0] : doc.refType === "pack" ? doc.refId : "";
    return {
      id: String(doc._id),
      ref: refTitle(doc.refType),
      sub: adTitle ?? (paymentId && /^[0-9a-f]{24}$/i.test(paymentId) ? receiptNo(paymentId) : doc.refId.slice(0, 40)),
      statusText: doc.delta >= 0 ? "Credits added" : "Credits used",
      statusTone: doc.delta >= 0 ? "ok" : "neutral",
      test: false,
      amount: `${sign} credits`,
      who: person?.name ?? "Unknown",
      at: when(doc.createdAt),
      details: [
        ["User", person ? `${person.name} (${person.email})` : "Unknown"],
        ["Change", `${sign} credits`],
        ["Balance after", `${doc.balanceAfter.toLocaleString("en-IN")} credits`],
        ["What for", refTitle(doc.refType)],
        ...(adTitle ? [["Ad", adTitle] as [string, string]] : []),
        ["Reference", doc.refId],
      ],
      receipt: paymentId && /^[0-9a-f]{24}$/i.test(paymentId) ? `/admin/finance/receipt/${paymentId}/` : null,
      act: null,
    };
  });
  return { rows, total };
}

type PromotionLean = { _id: Types.ObjectId; userId: Types.ObjectId; listingId: Types.ObjectId; productId: Types.ObjectId; status: string; durationDays: number; startsAt?: Date; endsAt?: Date; createdAt?: Date };

async function promotionRows(query: OrderQuery, skip: number, now: Date): Promise<{ rows: OrderRow[]; total: number }> {
  const filter: QueryFilter<Record<string, unknown>> = {};
  const since = sinceOf(query.range, now);
  if (since) filter.createdAt = { $gte: since };
  if (query.q) filter.userId = { $in: await matchingUsers(query.q) };
  const [docs, total] = await Promise.all([
    PromotionOrder.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(query.pageSize).lean<PromotionLean[]>(),
    PromotionOrder.countDocuments(filter),
  ]);
  const [people, products, listings] = await Promise.all([
    names(docs.map((doc) => doc.userId)),
    PromotionProduct.find({ _id: { $in: docs.map((doc) => doc.productId) } }).select("name amount").lean<{ _id: Types.ObjectId; name: string; amount: number }[]>(),
    Listing.find({ _id: { $in: docs.map((doc) => doc.listingId) } }).select("title").lean<{ _id: Types.ObjectId; title?: string }[]>(),
  ]);
  const productOf = new Map(products.map((row) => [String(row._id), row]));
  const listingOf = new Map(listings.map((row) => [String(row._id), row.title ?? "An ad"]));
  const rows: OrderRow[] = docs.map((doc) => {
    const person = people.get(String(doc.userId));
    const product = productOf.get(String(doc.productId));
    const tone: StatusTone = doc.status === "active" ? "ok" : doc.status === "pending" ? "warn" : "bad";
    const text = doc.status === "active" ? (doc.endsAt && doc.endsAt.getTime() < now.getTime() ? "Ended" : "Live") : doc.status === "pending" ? "Waiting" : "Failed";
    return {
      id: String(doc._id),
      ref: product?.name ?? "Promotion",
      sub: listingOf.get(String(doc.listingId)) ?? "An ad",
      statusText: text,
      statusTone: text === "Ended" ? "neutral" : tone,
      test: false,
      amount: product ? `${product.amount.toLocaleString("en-IN")} credits` : "unknown",
      who: person?.name ?? "Unknown",
      at: when(doc.createdAt),
      details: [
        ["User", person ? `${person.name} (${person.email})` : "Unknown"],
        ["Plan", product?.name ?? "Unknown"],
        ["Ad", listingOf.get(String(doc.listingId)) ?? "An ad"],
        ["Status", text],
        ["Starts", doc.startsAt ? new Date(doc.startsAt).toISOString() : "not started"],
        ["Ends", doc.endsAt ? new Date(doc.endsAt).toISOString() : "not set"],
      ],
      receipt: null,
      act: null,
    };
  });
  return { rows, total };
}

/** One page of one tab. Needs the orders permission (finance and admins). Payouts have their own queue and are not listed here. */
export async function listOrders(query: OrderQuery, roles: readonly string[], now: Date = new Date()): Promise<OrderList> {
  requireView(roles);
  await connectDb();
  const skip = (query.page - 1) * query.pageSize;
  const kpis = await orderKpis(now);
  let part: { rows: OrderRow[]; total: number } = { rows: [], total: 0 };
  if (query.tab === "recharges") part = await rechargeRows(query, skip, now, can(roles, "orders.refund"));
  else if (query.tab === "fees") part = await entryRows(query, skip, now, [FEE_REF, FEE_REFUND_REF]);
  else if (query.tab === "refunds") part = await entryRows(query, skip, now, ["refund"]);
  else if (query.tab === "wallet") part = await entryRows(query, skip, now, null);
  else if (query.tab === "promotions") part = await promotionRows(query, skip, now);
  return { ...part, query, kpis };
}

export type Receipt = { no: string; at: string | null; user: string; email: string; method: string; amount: string; credits: number; status: string; test: boolean };

/** The facts of one recharge for its receipt page. A test payment says so. */
export async function getReceipt(id: string, roles: readonly string[]): Promise<Receipt> {
  requireView(roles);
  await connectDb();
  if (!mongoose.isValidObjectId(id)) throw new NotFoundError("Not found");
  const doc = await Payment.findById(id).lean<PaymentLean | null>();
  if (!doc || !doc.method) throw new NotFoundError("Not found");
  const person = (await names([doc.userId])).get(String(doc.userId));
  return {
    no: receiptNo(String(doc._id)),
    at: when(doc.createdAt),
    user: person?.name ?? "Unknown",
    email: person?.email ?? "",
    method: doc.method === "crypto" ? `Crypto${doc.coin ? `, ${doc.coin}${doc.network ? ` ${doc.network}` : ""}` : ""}` : "Card",
    amount: rupees(doc.amount),
    credits: doc.credits ?? 0,
    status: statusOf(doc as never),
    test: doc.provider === "mock",
  };
}
