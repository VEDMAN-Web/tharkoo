import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditEvent } from "@/server/models/trust";
import { requestWithdrawal } from "@/server/wallet/withdrawals";
import { REVEAL_LIMIT_PER_HOUR } from "@/server/wallet/payout-reveal";
import { setPayoutProvider } from "@/server/wallet/payout-provider";
import { call, earn, ip, person, req, withKyc } from "./payout-helpers";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const ENCRYPTION_KEY = "payout-reveal-encryption-key-01";

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  process.env.CONTACT_ENCRYPTION_KEY = ENCRYPTION_KEY;
  process.env.SESSION_SECRET = "session-secret";
  process.env.PAYOUT_PROVIDER = "mock";
  await connectMemoryMongo();
});
afterAll(async () => {
  delete process.env.CONTACT_ENCRYPTION_KEY;
  delete process.env.SESSION_SECRET;
  delete process.env.PAYOUT_PROVIDER;
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  setPayoutProvider(null);
});

/** One vendor with KYC and one requested withdrawal. Returns the withdrawal id. */
async function requestedWithdrawal(email: string) {
  const vendor = await person(`vendor-${email}`);
  await withKyc(vendor.id);
  await earn(vendor.id, 20);
  const row = await requestWithdrawal({ userId: vendor.id, coins: 5, requestId: req, ip });
  return row.id;
}

function reveal(cookie: string, id: string) {
  return call("POST", `/api/wallet/admin/payouts/${id}/reveal`, cookie);
}

describe("payout reveal", () => {
  it("refuses a plain user and any staff role other than finance or superadmin", async () => {
    const id = await requestedWithdrawal("refused");
    const user = await person("reveal-user@example.com");
    const moderator = await person("reveal-mod@example.com", ["moderator"]);
    expect((await reveal(user.cookie, id)).status).toBe(403);
    expect((await reveal(moderator.cookie, id)).status).toBe(403);
  });

  it("returns the full details for one withdrawal to finance, with cache-control no-store", async () => {
    const id = await requestedWithdrawal("finance");
    const finance = await person("reveal-finance@example.com", ["finance"]);
    const response = await reveal(finance.cookie, id);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as { data: { withdrawalId: string; details: Record<string, string> } };
    expect(body.data.withdrawalId).toBe(id);
    expect(body.data.details).toMatchObject({
      method: "bank",
      legalName: "Ada Lovelace",
      pan: "ABCDE1234F",
      accountNumber: "123456789012",
      ifsc: "HDFC0001234",
    });
  });

  it("lets superadmin reveal too", async () => {
    const id = await requestedWithdrawal("super");
    const superadmin = await person("reveal-super@example.com", ["superadmin"]);
    expect((await reveal(superadmin.cookie, id)).status).toBe(200);
  });

  it("writes one audit row with who, when and which withdrawal, and no values", async () => {
    const id = await requestedWithdrawal("audit");
    const finance = await person("reveal-audit@example.com", ["finance"]);
    expect((await reveal(finance.cookie, id)).status).toBe(200);

    const rows = await AuditEvent.find({ action: "payout.reveal" }).lean();
    expect(rows).toHaveLength(1);
    expect(String(rows[0].actorId)).toBe(finance.id);
    expect(rows[0]).toMatchObject({ actorType: "admin", targetType: "withdrawal", targetId: id });
    expect(rows[0].createdAt).toBeInstanceOf(Date);
    const stored = JSON.stringify(rows[0]);
    expect(stored).not.toContain("ABCDE1234F");
    expect(stored).not.toContain("123456789012");
    expect(stored).not.toContain("HDFC0001234");
    expect(stored).not.toContain("Ada Lovelace");
  });

  it("refuses the 21st reveal in an hour for the same staff member", async () => {
    const id = await requestedWithdrawal("limit");
    const finance = await person("reveal-limit@example.com", ["finance"]);
    for (let i = 0; i < REVEAL_LIMIT_PER_HOUR; i += 1) {
      expect((await reveal(finance.cookie, id)).status).toBe(200);
    }
    const refused = await reveal(finance.cookie, id);
    expect(refused.status).toBe(429);
    const body = (await refused.json()) as { error: { code: string } };
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("returns 404 for a withdrawal that does not exist", async () => {
    const finance = await person("reveal-missing@example.com", ["finance"]);
    const response = await reveal(finance.cookie, new mongoose.Types.ObjectId().toString());
    expect(response.status).toBe(404);
  });
});
