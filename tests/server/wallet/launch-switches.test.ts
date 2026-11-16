import { POST as walletPost } from "@/app/api/wallet/[[...slug]]/route";
import { POST as toursPost } from "@/app/api/tours/[[...slug]]/route";
import { hashToken } from "@/server/auth/http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invalidateTags } from "@/lib/cache";
import { checkoutPack, purchasePromotion } from "@/server/billing";
import { requestTour, tourCallFor } from "@/server/tours/service";
import { AuditEvent, Session, Site, User } from "@/server/models";
import { readLaunchSwitches, setLaunchSwitch } from "@/server/wallet/launch-switches";
import { startCoinPurchase } from "@/server/wallet/purchase";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin = { actorId: "000000000000000000000001", roles: ["admin"], requestId: "req" };
const ID = "000000000000000000000002";
const original = process.env.LAUNCH_SWITCHES_DEFAULT;

beforeAll(async () => {
  await connectMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  invalidateTags(["site"]);
  process.env.LAUNCH_SWITCHES_DEFAULT = "off";
});
afterEach(() => {
  if (original === undefined) delete process.env.LAUNCH_SWITCHES_DEFAULT;
  else process.env.LAUNCH_SWITCHES_DEFAULT = original;
});

describe("launch switches default to Coming soon", () => {
  it("are both off when nothing is saved and the default is not on", async () => {
    expect(await readLaunchSwitches()).toEqual({ creditPurchasesOn: false, videoCallsOn: false });
    delete process.env.LAUNCH_SWITCHES_DEFAULT;
    expect(await readLaunchSwitches()).toEqual({ creditPurchasesOn: false, videoCallsOn: false });
  });

  it("follow the default only until a value is saved", async () => {
    process.env.LAUNCH_SWITCHES_DEFAULT = "on";
    expect(await readLaunchSwitches()).toEqual({ creditPurchasesOn: true, videoCallsOn: true });
    await setLaunchSwitch({ ...admin, name: "videoCallsOn", on: false });
    expect(await readLaunchSwitches()).toEqual({ creditPurchasesOn: true, videoCallsOn: false });
  });
});

describe("with the switches off the server refuses", () => {
  it("a credit purchase in both checkout services", async () => {
    await expect(checkoutPack({ userId: ID, packId: ID, requestId: "r" })).rejects.toThrow(/coming soon/i);
    await expect(startCoinPurchase({ userId: ID, packId: ID, requestId: "r" })).rejects.toThrow(/coming soon/i);
  });

  it("a promotion purchase", async () => {
    await expect(purchasePromotion({ userId: ID, listingId: ID, productId: ID, requestId: "r" })).rejects.toThrow(/coming soon/i);
  });

  it("a video call request and a call room", async () => {
    await expect(requestTour({ userId: ID, listingId: ID, requestId: "r" })).rejects.toThrow(/coming soon/i);
    await expect(tourCallFor({ userId: ID, tourId: ID })).rejects.toThrow(/coming soon/i);
  });
});

describe("the routes answer with a friendly message when the switches are off", () => {
  it("returns 409 for a credit checkout and for a video call request", async () => {
    const user = await User.create({
      email: "route@example.test",
      passwordHash: "hash",
      displayName: "Ada",
      dateOfBirth: new Date("1995-04-02"),
      attestedAdultAt: new Date(),
      emailVerifiedAt: new Date(),
      roles: ["user"],
      verificationStatus: "approved",
      status: "active",
    });
    await Session.create({ userId: user._id, tokenHash: hashToken("tok-route"), expiresAt: new Date(Date.now() + 86_400_000) });
    const headers = { origin: "http://127.0.0.1:4317", cookie: "sid=tok-route", "content-type": "application/json" };
    const checkout = await walletPost(
      new Request("http://127.0.0.1:4317/api/wallet/coins/checkout", { method: "POST", headers, body: JSON.stringify({ packId: ID, idempotencyKey: "key-12345678" }) }),
    );
    expect(checkout.status).toBe(409);
    expect(JSON.stringify(await checkout.json())).toMatch(/coming soon/i);
    const tour = await toursPost(new Request("http://127.0.0.1:4317/api/tours/request", { method: "POST", headers, body: JSON.stringify({ listingId: ID }) }));
    expect(tour.status).toBe(409);
    expect(JSON.stringify(await tour.json())).toMatch(/coming soon/i);
  });
});

describe("with the switches on the guard lets the request through", () => {
  it("credit purchases reach the normal checks", async () => {
    await setLaunchSwitch({ ...admin, name: "creditPurchasesOn", on: true });
    const failure = await checkoutPack({ userId: ID, packId: ID, requestId: "r" }).catch((error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).not.toMatch(/coming soon/i);
    const coin = await startCoinPurchase({ userId: ID, packId: ID, requestId: "r" }).catch((error: Error) => error);
    expect((coin as Error).message).not.toMatch(/coming soon/i);
    const promo = await purchasePromotion({ userId: ID, listingId: ID, productId: ID, requestId: "r" }).catch((error: Error) => error);
    expect((promo as Error).message).not.toMatch(/coming soon/i);
  });

  it("video calls reach the normal checks", async () => {
    await setLaunchSwitch({ ...admin, name: "videoCallsOn", on: true });
    const failure = await requestTour({ userId: ID, listingId: ID, requestId: "r" }).catch((error: Error) => error);
    expect((failure as Error).message).not.toMatch(/coming soon/i);
    const room = await tourCallFor({ userId: ID, tourId: ID }).catch((error: Error) => error);
    expect((room as Error).message).not.toMatch(/coming soon/i);
  });
});

describe("setLaunchSwitch", () => {
  it("is for admins only, rejects an unknown switch, and writes an audit row", async () => {
    await expect(setLaunchSwitch({ ...admin, roles: ["support"], name: "videoCallsOn", on: true })).rejects.toThrow(/admin/i);
    await expect(setLaunchSwitch({ ...admin, name: "somethingElse", on: true })).rejects.toThrow();
    await setLaunchSwitch({ ...admin, name: "creditPurchasesOn", on: true });
    const site = await Site.findOne({ key: "default" }).lean<{ creditPurchasesOn?: boolean }>();
    expect(site?.creditPurchasesOn).toBe(true);
    const rows = await AuditEvent.find({ action: "settings.launch_switch.update" }).lean();
    expect(rows).toHaveLength(1);
  });
});
