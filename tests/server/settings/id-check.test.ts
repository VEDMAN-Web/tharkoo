import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PUT } from "@/app/api/admin/settings/id-check/route";
import { hashToken } from "@/server/auth/http";
import { ForbiddenError } from "@/server/http";
import { AuditEvent, Site, Session, User } from "@/server/models";
import { IdCheckFirst } from "@/components/post/IdCheckFirst";
import { ensureIdCheckSetting, idCheckRequired, idCheckScreen, setIdCheckRequired } from "@/server/settings/id-check";
import { assertVerified } from "@/server/verification/service";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const origin = "http://127.0.0.1:4317";

async function account(email: string, roles = ["user"], verificationStatus: "unsubmitted" | "approved" = "unsubmitted") {
  const user = await User.create({
    email,
    passwordHash: "hash",
    displayName: "Ada",
    dateOfBirth: new Date("1995-04-02"),
    attestedAdultAt: new Date(),
    emailVerifiedAt: new Date(),
    roles,
    verificationStatus,
    status: "active",
  });
  const token = `tok-${email}`;
  await Session.create({ userId: user._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 86_400_000) });
  return { id: user._id.toString(), cookie: `sid=${encodeURIComponent(token)}` };
}

function putSetting(required: boolean, cookie: string) {
  return PUT(
    new Request(`${origin}/api/admin/settings/id-check`, {
      method: "PUT",
      headers: { origin, "content-type": "application/json", cookie },
      body: JSON.stringify({ required }),
    }),
  );
}

async function storedSwitch() {
  const site = await Site.findOne({ key: "default" }).lean<{ requireIdCheckToPost?: boolean } | null>();
  return site?.requireIdCheckToPost;
}

beforeAll(async () => {
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});

afterAll(async () => {
  await disconnectMemoryMongo();
});

beforeEach(async () => {
  await clearMemoryMongo();
});

describe("ID-check switch: default and migration (H6.14)", () => {
  it("is off when nothing is stored, and the post-ad screen is the form", async () => {
    expect(await idCheckRequired()).toBe(false);
    expect(await assertVerified((await account("default@example.com")).id)).toBeUndefined();
  });

  it("the migration stores off when the value is missing, once, and never changes a stored value", async () => {
    await Site.collection.insertOne({ key: "default", orgName: "Tharkoo" });
    expect(await ensureIdCheckSetting("test:1")).toEqual({ updated: 1 });
    expect(await storedSwitch()).toBe(false);
    expect(await AuditEvent.countDocuments({ action: "settings.id_check.default" })).toBe(1);
    expect(await ensureIdCheckSetting("test:2")).toEqual({ updated: 0 });

    await Site.updateOne({ key: "default" }, { $set: { requireIdCheckToPost: true } });
    expect(await ensureIdCheckSetting("test:3")).toEqual({ updated: 0 });
    expect(await storedSwitch()).toBe(true);
    expect(await idCheckRequired()).toBe(true);
  });

  it("the migration does nothing when there is no site document yet (the code default is off)", async () => {
    expect(await ensureIdCheckSetting("test:none")).toEqual({ updated: 0 });
    expect(await idCheckRequired()).toBe(false);
  });
});

describe("ID-check switch: superadmin only and audited (H6.14)", () => {
  it("a superadmin switches it on and off, and each change is audited with before and after", async () => {
    const actor = await account("root@example.com", ["superadmin"]);
    await expect(setIdCheckRequired({ actorId: actor.id, roles: ["superadmin"], required: true, requestId: "r1" })).resolves.toEqual({
      required: true,
    });
    expect(await idCheckRequired()).toBe(true);
    await setIdCheckRequired({ actorId: actor.id, roles: ["superadmin"], required: false, requestId: "r2" });
    expect(await idCheckRequired()).toBe(false);
    const events = await AuditEvent.find({ action: "settings.id_check.update" }).sort({ createdAt: 1 }).lean();
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ before: { requireIdCheckToPost: false }, after: { requireIdCheckToPost: true } });
    expect(events[1]).toMatchObject({ before: { requireIdCheckToPost: true }, after: { requireIdCheckToPost: false } });
  });

  it("an admin or any other role cannot change it, and nothing is written", async () => {
    await expect(
      setIdCheckRequired({ actorId: "000000000000000000000001", roles: ["admin", "trust_safety"], required: true, requestId: "r3" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await idCheckRequired()).toBe(false);
    expect(await AuditEvent.countDocuments({ action: "settings.id_check.update" })).toBe(0);
  });

  it("the admin route answers 403 to an admin and 200 to a superadmin", async () => {
    const admin = await account("admin@example.com", ["admin"]);
    const root = await account("root2@example.com", ["superadmin"]);
    expect((await putSetting(true, admin.cookie)).status).toBe(403);
    expect(await idCheckRequired()).toBe(false);
    const ok = await putSetting(true, root.cookie);
    expect(ok.status).toBe(200);
    expect((await ok.json()).data).toEqual({ required: true });
    expect(await idCheckRequired()).toBe(true);
  });
});

describe("ID-check switch: the gate (H6.14)", () => {
  it("with the switch on, an unapproved person is still refused by assertVerified", async () => {
    const owner = await account("on@example.com");
    await setIdCheckRequired({ actorId: owner.id, roles: ["superadmin"], required: true, requestId: "r4" });
    await expect(assertVerified(owner.id)).rejects.toMatchObject({ code: "VERIFICATION_REQUIRED" });
  });

  it("the check-first screen: form when off, verify when unsubmitted or rejected, checking when pending, form when approved", () => {
    expect(idCheckScreen(false, "unsubmitted")).toBe("form");
    expect(idCheckScreen(true, "approved")).toBe("form");
    expect(idCheckScreen(true, "unsubmitted")).toBe("verify");
    expect(idCheckScreen(true, "rejected")).toBe("verify");
    expect(idCheckScreen(true, undefined)).toBe("verify");
    expect(idCheckScreen(true, "pending_review")).toBe("checking");
  });

  it("renders 'Verify your ID first' with a button to the ID page, and 'We are checking your ID' while pending", () => {
    const verify = renderToStaticMarkup(createElement(IdCheckFirst, { screen: "verify", postPath: "/u/post-insert/" }));
    expect(verify).toContain("Verify your ID first");
    expect(verify).toContain('href="/u/account/kyc');
    expect(verify).toContain('data-tk="verify-id"');
    expect(verify).not.toContain("data-tk=\"go-on\"");

    const checking = renderToStaticMarkup(createElement(IdCheckFirst, { screen: "checking", postPath: "/u/post-insert/" }));
    expect(checking).toContain("We are checking your ID");
    expect(checking).not.toContain("Verify your ID first");
    expect(checking).not.toContain('href="/u/account/kyc');
  });
});
