import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as paymentsGet, POST as paymentsPost } from "@/app/api/payments/[[...slug]]/route";
import { hashToken } from "@/server/auth/http";
import { walletBalance } from "@/server/billing/ledger";
import { setMoneySettings } from "@/server/billing/money-settings";
import {
  chooseCoin,
  confirmMockPayment,
  estimateCoinAmount,
  listOwnPayments,
  mockDepositAddress,
  packBadge,
  paymentView,
  readOwnPayment,
  rechargePacks,
  startRecharge,
} from "@/server/billing/recharge";
import { AuditEvent, CreditPack, Payment, Session, User, WalletEntry } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const origin = "http://127.0.0.1:4317";
const admin = { actorId: "000000000000000000000001", roles: ["admin"], requestId: "req" };

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  process.env.PAYMENT_PROVIDER = "mock";
  await connectMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});

async function member(prefix = "buyer") {
  return User.create({
    email: `${prefix}${Math.random().toString(36).slice(2, 8)}@example.com`,
    displayName: "Asha",
    passwordHash: "x",
    status: "active",
    roles: ["user"],
    dateOfBirth: new Date("1990-01-01"),
    attestedAdultAt: new Date(),
    verificationStatus: "approved",
  });
}

async function packs() {
  const small = await CreditPack.create({ credits: 100, price: 1000, bonus: 0, status: "active", order: 0 });
  const popular = await CreditPack.create({ credits: 500, price: 4250, bonus: 75, tag: "Most popular", status: "active", order: 3 });
  const best = await CreditPack.create({ credits: 3000, price: 24000, bonus: 1200, tag: "Best deal", status: "active", order: 9 });
  return { small, popular, best };
}

describe("the recharge packs", () => {
  it("are sorted by size with Most popular and Best value badges and the bonus kept apart", async () => {
    const { best } = await packs();
    await CreditPack.create({ credits: 10, price: 100, bonus: 0, status: "inactive", order: 1 });
    const list = await rechargePacks();
    expect(list.map((pack) => pack.total)).toEqual([100, 575, 4200]);
    expect(list[1]).toMatchObject({ credits: 500, bonus: 75, price: 4250, badge: "popular" });
    expect(list[2]).toMatchObject({ id: String(best._id), badge: "best" });
    expect(packBadge("Extra credits")).toBeNull();
  });
});

describe("starting a recharge", () => {
  it("records a card purchase with the pack, the amount and the credits it will add", async () => {
    const user = await member();
    const { popular } = await packs();
    const started = await startRecharge({ userId: user.id, packId: String(popular._id), method: "card", returnTo: "/u/post-insert/", requestId: "r" });
    expect(started.checkoutPath).toBe(`/pay/checkout/${started.paymentId}/`);
    const view = await readOwnPayment(user.id, started.paymentId);
    expect(view).toMatchObject({ method: "card", coin: null, network: null, amount: 4250, credits: 575, status: "pending", returnTo: "/u/post-insert/", expiresAt: null });
    expect(await walletBalance(user.id)).toBe(0);
  });

  it("records a crypto purchase with the coin, the network and a 30 minute window", async () => {
    const user = await member();
    const { small } = await packs();
    const started = await startRecharge({ userId: user.id, packId: String(small._id), method: "crypto", requestId: "r" });
    expect(await readOwnPayment(user.id, started.paymentId)).toMatchObject({ method: "crypto", coin: null, expiresAt: null, depositAddress: null });
    const view = await chooseCoin({ userId: user.id, paymentId: started.paymentId, coin: "USDT", network: "TRC-20", requestId: "r" });
    expect(view).toMatchObject({ method: "crypto", coin: "USDT", network: "TRC-20", amount: 1000, credits: 100, status: "pending", cryptoAmount: "11.36" });
    const minutes = (new Date(view.expiresAt!).getTime() - Date.now()) / 60000;
    expect(minutes).toBeGreaterThan(29);
    expect(minutes).toBeLessThanOrEqual(30);
    expect(view.depositAddress).toMatch(/^T[A-Za-z0-9]{33}$/);
    const bitcoin = await startRecharge({ userId: user.id, packId: String(small._id), method: "crypto", requestId: "r" });
    expect((await chooseCoin({ userId: user.id, paymentId: bitcoin.paymentId, coin: "BTC", requestId: "r" })).depositAddress).toMatch(/^bc1q/);
    expect((await chooseCoin({ userId: user.id, paymentId: bitcoin.paymentId, coin: "ETH", requestId: "r" })).depositAddress).toMatch(/^0x/);
  });

  it("asks for a network for USDT and USDC and refuses an unknown method or coin", async () => {
    const user = await member();
    const { small } = await packs();
    const base = { userId: user.id, packId: String(small._id), requestId: "r" };
    await expect(startRecharge({ ...base, method: "crypto", coin: "USDC" })).rejects.toThrow(/Invalid request/);
    await expect(startRecharge({ ...base, method: "crypto", coin: "DOGE" })).rejects.toThrow(/Invalid request/);
    await expect(startRecharge({ ...base, method: "cheque" })).rejects.toThrow(/Invalid request/);
    expect(await Payment.countDocuments({})).toBe(0);
    const started = await startRecharge({ ...base, method: "crypto" });
    await expect(chooseCoin({ userId: user.id, paymentId: started.paymentId, coin: "USDT", requestId: "r" })).rejects.toThrow(/Invalid request/);
    await expect(chooseCoin({ userId: user.id, paymentId: started.paymentId, coin: "USDT", network: "SOL", requestId: "r" })).rejects.toThrow(/Invalid request/);
    await expect(chooseCoin({ userId: user.id, paymentId: started.paymentId, coin: "DOGE", requestId: "r" })).rejects.toThrow(/Invalid request/);
    const card = await startRecharge({ ...base, method: "card" });
    await expect(chooseCoin({ userId: user.id, paymentId: card.paymentId, coin: "BTC", requestId: "r" })).rejects.toThrow(/not a crypto/i);
  });

  it("refuses while mock payments are off and nothing real is connected", async () => {
    const user = await member();
    const { small } = await packs();
    await setMoneySettings({ ...admin, values: { mockPaymentsOn: false } });
    await expect(startRecharge({ userId: user.id, packId: String(small._id), method: "card", requestId: "r" })).rejects.toThrow(/not available/i);
    expect(await Payment.countDocuments({})).toBe(0);
  });

  it("keeps only a safe return path", async () => {
    const user = await member();
    const { small } = await packs();
    const started = await startRecharge({ userId: user.id, packId: String(small._id), method: "card", returnTo: "https://evil.example/", requestId: "r" });
    expect((await readOwnPayment(user.id, started.paymentId)).returnTo).toBe("");
  });
});

describe("the mock payment page", () => {
  it("adds the pack and its bonus to the wallet once, through the verified payment path", async () => {
    const user = await member();
    const { popular } = await packs();
    const started = await startRecharge({ userId: user.id, packId: String(popular._id), method: "card", requestId: "r" });
    const first = await confirmMockPayment({ userId: user.id, paymentId: started.paymentId, outcome: "paid", requestId: "r" });
    expect(first.balance).toBe(575);
    expect(first.payment.status).toBe("paid");
    const again = await confirmMockPayment({ userId: user.id, paymentId: started.paymentId, outcome: "paid", requestId: "r2" });
    expect(again.balance).toBe(575);
    expect(await WalletEntry.countDocuments({ userId: user.id })).toBe(2);
    const row = await Payment.findById(started.paymentId).lean();
    expect(row).toMatchObject({ status: "paid", outcome: "paid" });
    expect(await AuditEvent.countDocuments({ action: "recharge.mock_paid" })).toBe(1);
  });

  it("adds nothing when the buyer cancels, and a closed payment cannot be paid later", async () => {
    const user = await member();
    const { small } = await packs();
    const started = await startRecharge({ userId: user.id, packId: String(small._id), method: "card", requestId: "r" });
    const cancelled = await confirmMockPayment({ userId: user.id, paymentId: started.paymentId, outcome: "cancelled", requestId: "r" });
    expect(cancelled.payment.status).toBe("cancelled");
    expect(cancelled.balance).toBe(0);
    await expect(confirmMockPayment({ userId: user.id, paymentId: started.paymentId, outcome: "paid", requestId: "r" })).rejects.toThrow(/closed/i);
    expect(await walletBalance(user.id)).toBe(0);
  });

  it("refuses somebody else's payment, an unknown outcome, an expired crypto window and mock off", async () => {
    const user = await member();
    const other = await member("other");
    const { small } = await packs();
    const card = await startRecharge({ userId: user.id, packId: String(small._id), method: "card", requestId: "r" });
    await expect(confirmMockPayment({ userId: other.id, paymentId: card.paymentId, outcome: "paid", requestId: "r" })).rejects.toThrow(/not found/i);
    await expect(confirmMockPayment({ userId: user.id, paymentId: card.paymentId, outcome: "free", requestId: "r" })).rejects.toThrow(/invalid/i);
    const crypto = await startRecharge({ userId: user.id, packId: String(small._id), method: "crypto", requestId: "r" });
    await chooseCoin({ userId: user.id, paymentId: crypto.paymentId, coin: "BTC", requestId: "r" });
    await Payment.updateOne({ _id: crypto.paymentId }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await readOwnPayment(user.id, crypto.paymentId)).status).toBe("expired");
    await expect(confirmMockPayment({ userId: user.id, paymentId: crypto.paymentId, outcome: "paid", requestId: "r" })).rejects.toThrow(/window has ended/i);
    expect((await readOwnPayment(user.id, crypto.paymentId)).status).toBe("expired");
    await setMoneySettings({ ...admin, values: { mockPaymentsOn: false } });
    await expect(confirmMockPayment({ userId: user.id, paymentId: card.paymentId, outcome: "paid", requestId: "r" })).rejects.toThrow(/not available/i);
    expect(await walletBalance(user.id)).toBe(0);
  });

  it("lists each purchase with method, amount, credits and status for the history", async () => {
    const user = await member();
    const { small, popular } = await packs();
    const a = await startRecharge({ userId: user.id, packId: String(small._id), method: "card", requestId: "r" });
    await confirmMockPayment({ userId: user.id, paymentId: a.paymentId, outcome: "paid", requestId: "r" });
    const eth = await startRecharge({ userId: user.id, packId: String(popular._id), method: "crypto", requestId: "r" });
    await chooseCoin({ userId: user.id, paymentId: eth.paymentId, coin: "ETH", requestId: "r" });
    const list = await listOwnPayments(user.id, 1, 20);
    expect(list.total).toBe(2);
    expect(list.items.map((item) => [item.method, item.amount, item.credits, item.status])).toEqual([
      ["crypto", 4250, 575, "pending"],
      ["card", 1000, 100, "paid"],
    ]);
    expect(list.items[1].receiptNo).toMatch(/^TK-[0-9A-F]{8}$/);
  });
});

describe("two confirmations at the same moment", () => {
  async function race(method: "card" | "crypto") {
    await WalletEntry.init();
    const user = await member();
    const { popular } = await packs();
    let expected = 0;
    for (let round = 0; round < 20; round += 1) {
      const started = await startRecharge({ userId: user.id, packId: String(popular._id), method, requestId: `s${round}` });
      if (method === "crypto") await chooseCoin({ userId: user.id, paymentId: started.paymentId, coin: "USDT", network: "TRC-20", requestId: `c${round}` });
      const results = await Promise.allSettled([
        confirmMockPayment({ userId: user.id, paymentId: started.paymentId, outcome: "paid", requestId: `a${round}` }),
        confirmMockPayment({ userId: user.id, paymentId: started.paymentId, outcome: "paid", requestId: `b${round}` }),
      ]);
      expect(results.map((row) => row.status), `round ${round}`).toEqual(["fulfilled", "fulfilled"]);
      expected += 575;
      expect(await walletBalance(user.id), `round ${round}`).toBe(expected);
      expect(await WalletEntry.countDocuments({ userId: user.id, refType: "pack", refId: started.paymentId }), `round ${round}`).toBe(1);
      expect(await WalletEntry.countDocuments({ userId: user.id, refType: "pack_bonus", refId: `${started.paymentId}:bonus` }), `round ${round}`).toBe(1);
      const row = await Payment.findById(started.paymentId).lean();
      expect(row, `round ${round}`).toMatchObject({ status: "paid", outcome: "paid" });
      const again = await confirmMockPayment({ userId: user.id, paymentId: started.paymentId, outcome: "paid", requestId: `z${round}` });
      expect(again.payment.status).toBe("paid");
      expect(again.balance).toBe(expected);
    }
    expect(await WalletEntry.countDocuments({ userId: user.id })).toBe(40);
  }

  it("credit the card pack and its bonus once, 20 rounds, and the second call answers without an error", async () => {
    await race("card");
  });

  it("credit the crypto pack and its bonus once, 20 rounds", async () => {
    await race("crypto");
  });
});

describe("the routes", () => {
  async function signedIn() {
    const user = await member("route");
    await Session.create({ userId: user._id, tokenHash: hashToken("tok-recharge"), expiresAt: new Date(Date.now() + 86_400_000) });
    return { user, cookie: "sid=tok-recharge" };
  }

  it("serve the sheet data, start a purchase, confirm it and show the receipt", async () => {
    const { user, cookie } = await signedIn();
    const { popular } = await packs();
    const headers = { origin, cookie, "content-type": "application/json" };
    const list = (await (await paymentsGet(new Request(`${origin}/api/payments/packs`, { headers }))).json()) as { data: { packs: { total: number }[]; balance: number; available: boolean; creditPriceInr: number } };
    expect(list.data.packs.map((pack) => pack.total)).toEqual([100, 575, 4200]);
    expect(list.data).toMatchObject({ balance: 0, available: true, creditPriceInr: 10 });
    const start = (await (await paymentsPost(new Request(`${origin}/api/payments/recharge`, { method: "POST", headers, body: JSON.stringify({ packId: String(popular._id), method: "card" }) }))).json()) as { data: { paymentId: string } };
    const confirm = await paymentsPost(new Request(`${origin}/api/payments/${start.data.paymentId}/confirm`, { method: "POST", headers, body: JSON.stringify({ outcome: "paid" }) }));
    expect(confirm.status).toBe(200);
    expect(await walletBalance(user.id)).toBe(575);
    const receipt = (await (await paymentsGet(new Request(`${origin}/api/payments/${start.data.paymentId}`, { headers }))).json()) as { data: { status: string; credits: number } };
    expect(receipt.data).toMatchObject({ status: "paid", credits: 575 });
    const noCookie = await paymentsGet(new Request(`${origin}/api/payments/${start.data.paymentId}`, { headers: { origin } }));
    expect(noCookie.status).toBe(401);
  });
});

describe("the mock crypto helpers", () => {
  it("give a stable estimate and address per payment", () => {
    expect(estimateCoinAmount(5_500_000, "BTC")).toBe("1.00000000");
    expect(estimateCoinAmount(1000, "USDC")).toBe("11.36");
    expect(mockDepositAddress("ETH", null, "abc")).toBe(mockDepositAddress("ETH", null, "abc"));
    expect(mockDepositAddress("ETH", null, "abc")).toMatch(/^0x[0-9a-f]{40}$/);
    expect(mockDepositAddress("USDT", "BEP-20", "abc")).toMatch(/^0x[0-9a-f]{40}$/);
    expect(paymentView({ _id: new mongoose.Types.ObjectId(), userId: "u", amount: 5, currency: "INR", status: "pending", method: "card" }).depositAddress).toBeNull();
  });
});
