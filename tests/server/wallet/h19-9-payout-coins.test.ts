import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { accountBalance, postTransaction } from "@/server/ledger";
import { ValidationError } from "@/server/http";
import {
  assertPayoutWalletAllowed,
  estimateRange,
  findPayoutOption,
  listSupportedPayoutOptions,
  payoutCurrencies,
  payoutEstimate,
  RATE_CACHE_MS,
  RATE_UNAVAILABLE,
  resetPayoutCoinCache,
} from "@/server/wallet/payout-coins";
import { payoutKycSchema, submitPayoutKyc } from "@/server/wallet/payout-kyc";
import { setPayoutProvider } from "@/server/wallet/payout-provider";
import { approveWithdrawal, listPayoutsForStaff, requestWithdrawal, Withdrawal, withdrawalEstimate } from "@/server/wallet/withdrawals";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";
import { call, person } from "./payout-helpers";

const req = "req-h19-9";
const TRON = "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8";
const EVM = `0x${"a".repeat(40)}`;
const BTC_ADDR = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";
const LTC_ADDR = "LdP8Qox1VAhCzLJNqrr74YovaWYyNBUWvL";

/** What PassimPay's /v2/currencies would answer. USDC on BNB Chain is missing on purpose: an unsupported coin. */
const LIST = [
  { id: 71, currency: "USDT", platform: "TRON", rateUsd: "1" },
  { id: 72, currency: "USDT", platform: "BSC", rateUsd: 1 },
  { id: 91, currency: "USDC", platform: "ETH", rateUsd: 1 },
  { id: 5, currency: "BTC", platform: "BTC", rateUsd: 60000 },
  { id: 6, currency: "ETH", platform: "ETH", rateUsd: 3000 },
  { id: 8, currency: "TRX", platform: "TRX", rateUsd: 0.12 },
  { id: 9, currency: "LTC", platform: "LTC", rateUsd: 80 },
];

interface Seen {
  path: string;
  body: Record<string, unknown>;
}

/** In-memory PassimPay: no network. Each call is recorded; the answers are the fixtures below. */
function fakePassimpay(options: { list?: unknown[]; currenciesFail?: boolean; valid?: boolean; validateFail?: boolean; withdraw?: Record<string, unknown> } = {}) {
  const seen: Seen[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const path = String(url).replace("https://api.passimpay.io/v2/", "");
      if (!String(url).startsWith("https://api.passimpay.io/v2/")) throw new Error(`unexpected host ${url}`);
      seen.push({ path, body: JSON.parse(String(init.body)) });
      if (path === "currencies") {
        if (options.currenciesFail) throw new Error("network down");
        return new Response(JSON.stringify({ result: 1, list: options.list ?? LIST }));
      }
      if (path === "validateaddress") {
        if (options.validateFail) throw new Error("network down");
        return new Response(JSON.stringify({ result: options.valid === false ? 0 : 1 }));
      }
      if (path === "withdraw") return new Response(JSON.stringify(options.withdraw ?? { result: 1, transactionId: "tx-1" }));
      throw new Error(`unexpected path ${path}`);
    }),
  );
  return seen;
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  process.env.CONTACT_ENCRYPTION_KEY = "test-encryption-key-32-characters!!";
  process.env.PASSIMPAY_PLATFORM_ID = "123";
  process.env.PASSIMPAY_API_KEY = "test-key";
  process.env.USDT_INR_RATE = "88";
  await connectMemoryMongo();
});
afterAll(async () => {
  for (const key of ["CONTACT_ENCRYPTION_KEY", "PASSIMPAY_PLATFORM_ID", "PASSIMPAY_API_KEY", "USDT_INR_RATE"]) delete process.env[key];
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  setPayoutProvider(null);
  resetPayoutCoinCache();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("H19.9 the range maths", () => {
  const usdt = findPayoutOption("USDT", "TRC20")!;
  const btc = findPayoutOption("BTC", "BTC")!;

  it("cuts and raises by 3 percent", () => {
    // Rs 880 at Rs 88 per dollar is 10 dollars, and 1 USDT is 1 dollar.
    expect(estimateRange(880, 1, usdt, 88)).toMatchObject({ low: "9.70", high: "10.30", text: "You will get about 9.70 to 10.30 USDT" });
  });

  it("uses the live price of the coin and keeps its digits", () => {
    // 100 dollars at 60000 dollars per BTC is 0.00166666... BTC.
    expect(estimateRange(8800, 60000, btc, 88)).toMatchObject({ low: "0.00161666", high: "0.00171667" });
  });

  it("rounds the low end down and the high end up for a tiny amount", () => {
    // One credit at Rs 10 is 0.11363 USDT.
    expect(estimateRange(10, 1, usdt, 88)).toMatchObject({ low: "0.11", high: "0.12" });
  });

  it("handles the biggest withdrawal without losing cents", () => {
    // 1,000,000 credits at Rs 10 is Rs 10,000,000.
    expect(estimateRange(10_000_000, 1, usdt, 88)).toMatchObject({ low: "110227.27", high: "117045.46" });
  });

  it("never shows a range where the low end is above the high end", () => {
    for (const inr of [1, 7, 10, 99, 880, 12_345, 987_654]) {
      const range = estimateRange(inr, 1.0003, usdt, 88)!;
      expect(Number(range.low)).toBeLessThanOrEqual(Number(range.high));
    }
  });

  it("gives no range for a rate that is zero, negative or not a number", () => {
    expect(estimateRange(1000, 0, usdt, 88)).toBeNull();
    expect(estimateRange(1000, -1, usdt, 88)).toBeNull();
    expect(estimateRange(1000, Number.NaN, usdt, 88)).toBeNull();
    expect(estimateRange(0, 1, usdt, 88)).toBeNull();
    expect(estimateRange(1000, 1, usdt, 0)).toBeNull();
  });
});

describe("H19.9 the PassimPay coin list", () => {
  it("is asked once and reused for 5 minutes, then asked again", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-01T10:00:00Z"));
    const seen = fakePassimpay();
    await payoutCurrencies();
    await payoutCurrencies();
    vi.setSystemTime(new Date("2026-06-01T10:00:00Z").getTime() + RATE_CACHE_MS - 1);
    await payoutCurrencies();
    expect(seen.filter((s) => s.path === "currencies")).toHaveLength(1);
    vi.setSystemTime(new Date("2026-06-01T10:00:00Z").getTime() + RATE_CACHE_MS);
    await payoutCurrencies();
    expect(seen.filter((s) => s.path === "currencies")).toHaveLength(2);
  });

  it("sends one request when several people ask at the same time", async () => {
    const seen = fakePassimpay();
    await Promise.all([payoutCurrencies(), payoutCurrencies(), payoutCurrencies()]);
    expect(seen).toHaveLength(1);
  });

  it("signs the request with the platform id and never sends the key", async () => {
    const seen = fakePassimpay();
    await payoutCurrencies();
    expect(seen[0].body).toEqual({ platformId: 123 });
    const init = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0][1];
    expect(JSON.stringify(init.body)).not.toContain("test-key");
    expect((init.headers as Record<string, string>)["x-signature"]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("offers only the coins PassimPay lists", async () => {
    fakePassimpay();
    const offered = (await listSupportedPayoutOptions()).map((option) => `${option.coin}:${option.network}`);
    expect(offered).toEqual(["USDT:TRC20", "USDT:BEP20", "USDC:ERC20", "BTC:BTC", "ETH:ERC20", "TRX:TRC20", "LTC:LTC"]);
    expect(offered).not.toContain("USDC:BEP20");
  });

  it("drops listed items that have no usable id or rate", async () => {
    fakePassimpay({ list: [{ id: 71, currency: "USDT", platform: "TRON", rateUsd: 0 }, { id: "x", currency: "BTC", platform: "BTC", rateUsd: 1 }, { id: 5, currency: "BTC", platform: "BTC", rateUsd: 60000 }] });
    expect((await payoutCurrencies()).map((item) => item.id)).toEqual([5]);
  });
});

describe("H19.9 estimates when the rate cannot be had", () => {
  it("returns a range from the live rate", async () => {
    fakePassimpay();
    expect(await payoutEstimate(880, "USDT", "TRC20")).toMatchObject({ low: "9.70", high: "10.30" });
  });

  it("returns nothing when PassimPay is down, and the vendor text says the admin confirms", async () => {
    fakePassimpay({ currenciesFail: true });
    expect(await payoutEstimate(880, "USDT", "TRC20")).toBeNull();
    const vendorId = await vendorWithEarnings(100);
    expect(await withdrawalEstimate(vendorId, 50)).toMatchObject({ estimate: null, text: RATE_UNAVAILABLE });
    expect(RATE_UNAVAILABLE).toBe("Rate unavailable, the admin confirms the exact amount");
  });

  it("returns nothing for a coin PassimPay does not list", async () => {
    fakePassimpay();
    expect(await payoutEstimate(880, "USDC", "BEP20")).toBeNull();
    expect(await payoutEstimate(880, "DOGE", "TRC20")).toBeNull();
  });

  it("is back after the cache expires and the rate returns", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-01T10:00:00Z"));
    fakePassimpay();
    expect(await payoutEstimate(880, "USDT", "TRC20")).not.toBeNull();
    vi.setSystemTime(new Date("2026-06-01T10:06:00Z"));
    fakePassimpay({ currenciesFail: true });
    expect(await payoutEstimate(880, "USDT", "TRC20")).toBeNull();
  });
});

describe("H19.9 saving a wallet", () => {
  it("accepts a coin PassimPay lists with an address it accepts, and checks the address with the coin id", async () => {
    const seen = fakePassimpay();
    await expect(assertPayoutWalletAllowed({ coin: "BTC", network: "BTC", walletAddress: BTC_ADDR })).resolves.toBeUndefined();
    expect(seen.find((s) => s.path === "validateaddress")?.body).toEqual({ platformId: 123, paymentId: 5, address: BTC_ADDR });
  });

  it("refuses a coin PassimPay does not list", async () => {
    fakePassimpay();
    await expect(assertPayoutWalletAllowed({ coin: "USDC", network: "BEP20", walletAddress: EVM })).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses a coin that is not on our list at all", async () => {
    const seen = fakePassimpay();
    await expect(assertPayoutWalletAllowed({ coin: "DOGE", network: "TRC20", walletAddress: TRON })).rejects.toBeInstanceOf(ValidationError);
    expect(seen).toHaveLength(0);
  });

  it("refuses an address PassimPay says is not valid", async () => {
    fakePassimpay({ valid: false });
    await expect(assertPayoutWalletAllowed({ coin: "LTC", network: "LTC", walletAddress: LTC_ADDR })).rejects.toMatchObject({ fields: { walletAddress: [expect.stringContaining("not a valid LTC")] } });
  });

  it("saves nothing when the address check cannot be done", async () => {
    fakePassimpay({ validateFail: true });
    await expect(assertPayoutWalletAllowed({ coin: "USDT", network: "TRC20", walletAddress: TRON })).rejects.toThrow(/Could not check the wallet address/);
  });

  it("the form shape accepts each coin with its own address and refuses a mismatch", () => {
    const base = { method: "crypto", legalName: "Asha Rao", pan: "ABCDE1234F" };
    const ok = (extra: Record<string, unknown>) => payoutKycSchema.safeParse({ ...base, ...extra }).success;
    expect(ok({ coin: "USDT", network: "TRC20", walletAddress: TRON })).toBe(true);
    expect(ok({ network: "BEP20", walletAddress: EVM })).toBe(true);
    expect(ok({ coin: "USDC", network: "ERC20", walletAddress: EVM })).toBe(true);
    expect(ok({ coin: "BTC", network: "BTC", walletAddress: BTC_ADDR })).toBe(true);
    expect(ok({ coin: "ETH", network: "ERC20", walletAddress: EVM })).toBe(true);
    expect(ok({ coin: "TRX", network: "TRC20", walletAddress: TRON })).toBe(true);
    expect(ok({ coin: "LTC", network: "LTC", walletAddress: LTC_ADDR })).toBe(true);
    expect(ok({ coin: "BTC", network: "BTC", walletAddress: EVM })).toBe(false);
    expect(ok({ coin: "USDC", network: "TRC20", walletAddress: TRON })).toBe(false);
    expect(ok({ coin: "DOGE", network: "TRC20", walletAddress: TRON })).toBe(false);
    expect(ok({ coin: "LTC", network: "LTC", walletAddress: BTC_ADDR })).toBe(false);
  });
});

async function vendorWithEarnings(coins: number, wallet: { coin: string; network: string; walletAddress: string } = { coin: "USDT", network: "TRC20", walletAddress: TRON }) {
  const vendorId = new mongoose.Types.ObjectId().toString();
  await postTransaction({
    idempotencyKey: `earn:${vendorId}`,
    kind: "escrow_release",
    refType: "booking",
    refId: vendorId,
    moves: [
      { account: "external", ownerKey: "system", delta: -coins },
      { account: "vendor_earnings", ownerKey: vendorId, delta: coins },
    ],
    requestId: req,
    actorType: "system",
  });
  await submitPayoutKyc({ userId: vendorId, values: payoutKycSchema.parse({ method: "crypto", legalName: "Asha Rao", pan: "abcde1234f", ...wallet }), requestId: req });
  return vendorId;
}

const staff = { actorId: new mongoose.Types.ObjectId().toString(), roles: ["finance"], requestId: req };
const idOf = (row: unknown) => String((row as { id: string }).id);

describe("H19.9 what the vendor sees before withdrawing", () => {
  it("shows a range from the vendor's credits, the credit price and the live rate", async () => {
    fakePassimpay();
    const vendorId = await vendorWithEarnings(2000, { coin: "BTC", network: "BTC", walletAddress: BTC_ADDR });
    // 100 credits at Rs 10 is Rs 1000, about 11.3636 dollars, about 0.00018939 BTC.
    expect(await withdrawalEstimate(vendorId, 100)).toMatchObject({ coin: "BTC", network: "BTC", estimate: { low: "0.00018371", high: "0.00019508" }, text: "You will get about 0.00018371 to 0.00019508 BTC" });
  });

  it("treats a wallet saved before this change as USDT", async () => {
    fakePassimpay();
    const vendorId = await vendorWithEarnings(2000);
    await mongoose.connection.collection("payout_kyc").updateOne({ userId: new mongoose.Types.ObjectId(vendorId) }, { $unset: { cryptoCoin: "" } });
    expect(await withdrawalEstimate(vendorId, 88)).toMatchObject({ coin: "USDT", network: "TRC20" });
  });

  it("has nothing to show for a credit count that is not a whole positive number", async () => {
    fakePassimpay();
    const vendorId = await vendorWithEarnings(100);
    expect((await withdrawalEstimate(vendorId, 0)).text).toBe(RATE_UNAVAILABLE);
    expect((await withdrawalEstimate(vendorId, 1.5)).text).toBe(RATE_UNAVAILABLE);
  });

  it("serves the estimate and the coin list on the wallet routes", async () => {
    fakePassimpay();
    const vendor = await person("coins-vendor@example.test");
    const coins = await call("GET", "/api/wallet/payouts/coins", vendor.cookie);
    expect(coins.status).toBe(200);
    const options = ((await coins.json()) as { data: { options: { coin: string; network: string }[] } }).data.options;
    expect(options.map((o) => `${o.coin}:${o.network}`)).toContain("BTC:BTC");
    expect(options.map((o) => `${o.coin}:${o.network}`)).not.toContain("USDC:BEP20");
    expect((await call("GET", "/api/wallet/payouts/estimate?coins=0", vendor.cookie)).status).toBe(400);
    expect((await call("GET", "/api/wallet/payouts/estimate?coins=abc", vendor.cookie)).status).toBe(400);
  });

  it("refuses to save a wallet PassimPay rejects, through the route", async () => {
    fakePassimpay({ valid: false });
    const vendor = await person("bad-address@example.test");
    const res = await call("PUT", "/api/wallet/payouts/kyc", vendor.cookie, { method: "crypto", legalName: "Asha Rao", pan: "ABCDE1234F", coin: "ETH", network: "ERC20", walletAddress: EVM });
    expect(res.status).toBe(400);
    expect(await mongoose.connection.collection("payout_kyc").countDocuments()).toBe(0);
  });
});

describe("H19.9 the admin queue and the payout", () => {
  it("shows the coin, the network and the live estimate, then sends the amount the admin typed", async () => {
    const seen = fakePassimpay();
    const vendorId = await vendorWithEarnings(100, { coin: "ETH", network: "ERC20", walletAddress: EVM });
    const id = idOf(await requestWithdrawal({ userId: vendorId, coins: 60, requestId: req }));
    const queue = await listPayoutsForStaff({ roles: ["finance"] });
    expect(queue[0].payout).toMatchObject({ coin: "ETH", network: "ERC20" });
    // Rs 600 is about 6.8182 dollars, about 0.0022727 ETH.
    expect(queue[0].estimateText).toBe("You will get about 0.002204 to 0.002341 ETH");
    expect((await approveWithdrawal({ ...staff, id, usdtAmount: "0.0023" })).status).toBe("paid");
    const sent = seen.find((s) => s.path === "withdraw")!;
    expect(sent.body).toMatchObject({ paymentId: 6, addressTo: EVM, amount: "0.0023", orderId: id });
    expect((await Withdrawal.findById(id).lean())?.usdtAmount).toBe("0.0023");
  });

  it("says the admin confirms when the rate is down, and still lets the admin pay", async () => {
    fakePassimpay({ currenciesFail: true });
    const vendorId = await vendorWithEarnings(100, { coin: "BTC", network: "BTC", walletAddress: BTC_ADDR });
    await requestWithdrawal({ userId: vendorId, coins: 60, requestId: req });
    expect((await listPayoutsForStaff({ roles: ["finance"] }))[0].estimateText).toBe(RATE_UNAVAILABLE);
  });

  it("shows no estimate for a payout that is already decided", async () => {
    fakePassimpay();
    const vendorId = await vendorWithEarnings(100);
    const id = idOf(await requestWithdrawal({ userId: vendorId, coins: 60, requestId: req }));
    await approveWithdrawal({ ...staff, id });
    const [row] = await listPayoutsForStaff({ roles: ["finance"] });
    expect(row.status).toBe("paid");
    expect(row.estimateText).toBeNull();
  });

  it("will not guess an amount for a coin that is not a dollar coin: the payout stays requested", async () => {
    const seen = fakePassimpay();
    const vendorId = await vendorWithEarnings(100, { coin: "BTC", network: "BTC", walletAddress: BTC_ADDR });
    const id = idOf(await requestWithdrawal({ userId: vendorId, coins: 60, requestId: req }));
    await expect(approveWithdrawal({ ...staff, id })).rejects.toBeInstanceOf(ValidationError);
    expect((await Withdrawal.findById(id).lean())?.status).toBe("requested");
    expect(seen.some((s) => s.path === "withdraw")).toBe(false);
    expect(await accountBalance("payout_pending", vendorId)).toBe(60);
  });

  it("refuses an amount below the coin's smallest send, and a malformed one, without sending", async () => {
    const seen = fakePassimpay();
    const vendorId = await vendorWithEarnings(100, { coin: "BTC", network: "BTC", walletAddress: BTC_ADDR });
    const id = idOf(await requestWithdrawal({ userId: vendorId, coins: 60, requestId: req }));
    await expect(approveWithdrawal({ ...staff, id, usdtAmount: "0.000001" })).rejects.toBeInstanceOf(ValidationError);
    await expect(approveWithdrawal({ ...staff, id, usdtAmount: "1e3" })).rejects.toBeInstanceOf(ValidationError);
    expect(seen.some((s) => s.path === "withdraw")).toBe(false);
    expect((await Withdrawal.findById(id).lean())?.status).toBe("requested");
  });

  it("sizes a USDC payout from the rupees when the admin types nothing", async () => {
    const seen = fakePassimpay();
    const vendorId = await vendorWithEarnings(100, { coin: "USDC", network: "ERC20", walletAddress: EVM });
    const id = idOf(await requestWithdrawal({ userId: vendorId, coins: 88, requestId: req }));
    expect((await approveWithdrawal({ ...staff, id })).status).toBe("paid");
    // Rs 880 at Rs 88 is 10 dollars.
    expect(seen.find((s) => s.path === "withdraw")?.body).toMatchObject({ paymentId: 91, amount: "10.00" });
  });

  it("keeps paying USDT on TRON and BNB Chain with the ids from H18.6 and no extra lookup", async () => {
    const seen = fakePassimpay();
    const vendorId = await vendorWithEarnings(100, { coin: "USDT", network: "BEP20", walletAddress: EVM });
    const id = idOf(await requestWithdrawal({ userId: vendorId, coins: 50, requestId: req }));
    expect((await approveWithdrawal({ ...staff, id })).status).toBe("paid");
    expect(seen.map((s) => s.path)).toEqual(["withdraw"]);
    expect(seen[0].body).toMatchObject({ paymentId: 72 });
  });

  it("a coin PassimPay stopped listing is not sent: the payout stays requested", async () => {
    const seen = fakePassimpay({ list: LIST.filter((item) => item.currency !== "LTC") });
    const vendorId = await vendorWithEarnings(100, { coin: "LTC", network: "LTC", walletAddress: LTC_ADDR });
    const id = idOf(await requestWithdrawal({ userId: vendorId, coins: 50, requestId: req }));
    await expect(approveWithdrawal({ ...staff, id, usdtAmount: "0.5" })).rejects.toBeInstanceOf(ValidationError);
    expect(seen.some((s) => s.path === "withdraw")).toBe(false);
    expect((await Withdrawal.findById(id).lean())?.status).toBe("requested");
  });
});
