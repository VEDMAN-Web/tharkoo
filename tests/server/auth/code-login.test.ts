import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { codeOnlyLoginEnabled, setCodeOnlyLogin } from "@/server/auth/code-only";
import {
  CODE_CANNOT_BE_SENT,
  EmailLoginChallenge,
  loginCodeWarning,
  normalizeEmail,
  sendEmailLoginCode,
  verifyEmailLoginCode,
} from "@/server/auth/email-code";
import { loginUser, registerUser } from "@/server/auth/service";
import { ForbiddenError, InternalError, UnauthorizedError } from "@/server/http";
import { AuditEvent, FeatureFlag, Session, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const mail = vi.hoisted(() => ({ sent: [] as Array<{ to: string; code: string }>, failDelivery: false }));

// The mailer is replaced so no network call is made. The real function is only used for its environment rules.
vi.mock("@/server/mailer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/mailer")>();
  return {
    ...actual,
    deliverLoginCodeEmail: async (to: string, code: string) => {
      if (mail.failDelivery) return false;
      mail.sent.push({ to, code });
      return true;
    },
  };
});

const password = "password123";
const ip = "198.51.100.7";

async function person(email: string, roles: string[] = ["user"]) {
  return User.create({
    email,
    passwordHash: await bcrypt.hash(password, 4),
    displayName: "Ravi",
    dateOfBirth: new Date("1992-06-01"),
    attestedAdultAt: new Date(),
    emailVerifiedAt: new Date(),
    roles,
    verificationStatus: "approved",
    status: "active",
  });
}

function setNodeEnv(value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = value;
}

async function latestCode() {
  const last = mail.sent.at(-1);
  if (!last) throw new Error("no code was sent");
  return last.code;
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  process.env.SESSION_SECRET = "session-secret";
  await connectMemoryMongo();
  await EmailLoginChallenge.init();
});

afterAll(async () => {
  delete process.env.SESSION_SECRET;
  await disconnectMemoryMongo();
});

beforeEach(async () => {
  await clearMemoryMongo();
  mail.sent.length = 0;
  mail.failDelivery = false;
});

afterEach(() => {
  setNodeEnv("test");
  vi.restoreAllMocks();
});

describe("email addresses", () => {
  it("lower-cases and trims, and rejects anything that is not an address", () => {
    expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail("a b@example.com")).toBeNull();
  });
});

describe("email login codes", () => {
  it("sends a code to an active account and logs in with it", async () => {
    const user = await person("code-login@example.com");
    expect(await sendEmailLoginCode({ email: "Code-Login@Example.com", ip })).toEqual({ ok: true });
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]?.to).toBe("code-login@example.com");
    expect(mail.sent[0]?.code).toMatch(/^\d{6}$/);

    const result = await verifyEmailLoginCode({ email: "code-login@example.com", code: mail.sent[0]!.code, ip, requestId: "t-1" });
    expect(result.user.id).toBe(user.id);
    expect(result.token.length).toBeGreaterThan(20);
    expect(await Session.countDocuments({ userId: user._id })).toBe(1);
  });

  it("answers the same way for an unknown address but sends nothing", async () => {
    expect(await sendEmailLoginCode({ email: "nobody@example.com", ip })).toEqual({ ok: true });
    expect(mail.sent).toHaveLength(0);
    expect(await EmailLoginChallenge.countDocuments({})).toBe(0);
  });

  it("refuses to report a code as sent when delivery fails, and stores no live code", async () => {
    await person("delivery-fail@example.com");
    mail.failDelivery = true;
    await expect(sendEmailLoginCode({ email: "delivery-fail@example.com", ip })).rejects.toBeInstanceOf(InternalError);
    expect(await EmailLoginChallenge.countDocuments({})).toBe(0);
  });

  it("does not send in production without a mail provider, before any lookup", async () => {
    await person("prod-no-mail@example.com");
    setNodeEnv("production");
    delete process.env.BREVO_API_KEY;
    await expect(sendEmailLoginCode({ email: "prod-no-mail@example.com", ip })).rejects.toThrow(CODE_CANNOT_BE_SENT);
    expect(mail.sent).toHaveLength(0);
    expect(loginCodeWarning()).toBe(CODE_CANNOT_BE_SENT);
  });

  it("shows no dashboard warning off production", () => {
    expect(loginCodeWarning()).toBeNull();
  });

  it("limits sends to three per ten minutes per address", async () => {
    await person("rate@example.com");
    for (let index = 0; index < 3; index += 1) {
      expect(await sendEmailLoginCode({ email: "rate@example.com", ip: `198.51.100.${index + 20}` })).toEqual({ ok: true });
    }
    const fourth = await sendEmailLoginCode({ email: "rate@example.com", ip: "198.51.100.99" });
    expect(fourth.ok).toBe(false);
    expect(mail.sent).toHaveLength(3);
  });

  it("locks the code after five wrong guesses, even when the right code comes next", async () => {
    await person("lockout@example.com");
    await sendEmailLoginCode({ email: "lockout@example.com", ip });
    const right = await latestCode();
    const wrong = right === "000000" ? "111111" : "000000";
    for (let index = 0; index < 5; index += 1) {
      await expect(verifyEmailLoginCode({ email: "lockout@example.com", code: wrong, ip, requestId: "t-lock" })).rejects.toBeInstanceOf(UnauthorizedError);
    }
    await expect(verifyEmailLoginCode({ email: "lockout@example.com", code: right, ip, requestId: "t-lock" })).rejects.toBeInstanceOf(UnauthorizedError);
    expect(await AuditEvent.countDocuments({ action: "auth.login_code.locked" })).toBe(1);
  });

  it("a code works once", async () => {
    await person("once@example.com");
    await sendEmailLoginCode({ email: "once@example.com", ip });
    const code = await latestCode();
    await verifyEmailLoginCode({ email: "once@example.com", code, ip, requestId: "t-once" });
    await expect(verifyEmailLoginCode({ email: "once@example.com", code, ip, requestId: "t-once" })).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("marks a legacy email verified and writes a login audit entry", async () => {
    const user = await User.create({
      email: "legacy@example.com",
      passwordHash: await bcrypt.hash(password, 4),
      displayName: "Legacy",
      dateOfBirth: new Date("1990-01-01"),
      attestedAdultAt: new Date(),
      roles: ["user"],
      verificationStatus: "unsubmitted",
      status: "active",
    });
    await sendEmailLoginCode({ email: "legacy@example.com", ip });
    await verifyEmailLoginCode({ email: "legacy@example.com", code: await latestCode(), ip, requestId: "t-legacy" });
    const after = await User.findById(user._id).lean();
    expect(after?.emailVerifiedAt).toBeInstanceOf(Date);
    expect(await AuditEvent.countDocuments({ action: "auth.login_code.success", targetId: String(user._id) })).toBe(1);
  });
});

describe("code-only login switch", () => {
  it("is off by default and only a superadmin can change it", async () => {
    expect(await codeOnlyLoginEnabled()).toBe(false);
    await expect(setCodeOnlyLogin({ actorId: "x", roles: ["admin"], enabled: true, requestId: "t-sw" })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await codeOnlyLoginEnabled()).toBe(false);
  });

  it("a superadmin turns it on, the change is audited, and passwords stop working for users only", async () => {
    const admin = await person("root@example.com", ["superadmin"]);
    const user = await person("member@example.com");
    await setCodeOnlyLogin({ actorId: admin.id, roles: admin.roles, enabled: true, requestId: "t-on" });
    expect(await codeOnlyLoginEnabled()).toBe(true);
    expect(await FeatureFlag.countDocuments({ key: "code-only-login", enabled: true })).toBe(1);
    const audit = await AuditEvent.findOne({ action: "settings.code_only_login.update" }).lean();
    expect(audit?.before).toEqual({ enabled: false });
    expect(audit?.after).toEqual({ enabled: true });

    await expect(loginUser({ email: user.email, password, ip })).rejects.toBeInstanceOf(UnauthorizedError);
    const staff = await loginUser({ email: admin.email, password, ip });
    expect(staff.user.roles).toContain("superadmin");
    await expect(
      registerUser({
        email: "new@example.com",
        password,
        displayName: "New",
        dateOfBirth: "1995-04-02",
        acceptedTerms: true,
        attestedAdult: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await sendEmailLoginCode({ email: user.email, ip });
    const result = await verifyEmailLoginCode({ email: user.email, code: await latestCode(), ip, requestId: "t-code" });
    expect(result.user.id).toBe(user.id);
  });

  it("with the switch off, the old password login still works for users", async () => {
    const user = await person("old-login@example.com");
    const result = await loginUser({ email: user.email, password, ip });
    expect(result.user.id).toBe(user.id);
  });
});
