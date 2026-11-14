import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as authPost } from "@/app/api/auth/[[...slug]]/route";
import { PhoneIdentity, PhoneLoginChallenge, normalizePhone } from "@/server/auth/phone";
import { sendLoginCode, setOtpProvider, verifyLoginCode, type OtpProvider } from "@/server/auth/otp";
import { confirmPhone, startPhone } from "@/server/auth/service";
import { InternalError, ConflictError, UnauthorizedError } from "@/server/http";
import { Session, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const origin = "http://127.0.0.1:4317";
const sent: { phone: string; code: string }[] = [];
const recorder: OtpProvider = {
  name: "mock",
  send: async (message) => {
    sent.push(message);
  },
};

async function person(email: string) {
  return User.create({
    email,
    passwordHash: "hash",
    displayName: "Ravi",
    dateOfBirth: new Date("1992-06-01"),
    attestedAdultAt: new Date(),
    emailVerifiedAt: new Date(),
    roles: ["user"],
    verificationStatus: "approved",
    status: "active",
  });
}

/** Links a number the way a signed-in user does: startPhone logs its code (no SMS key is set), confirmPhone checks it. */
async function linkPhone(userId: string, rawPhone: string) {
  const logged: string[] = [];
  const spy = vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  });
  try {
    const started = await startPhone(userId, rawPhone);
    const line = logged.find((entry) => entry.includes("[phone-otp]"));
    const code = /code=(\d{6})/.exec(line ?? "")?.[1] ?? "";
    await confirmPhone(userId, started.challengeId, code);
  } finally {
    spy.mockRestore();
  }
}

function sendRequest(phone: string, ip = "198.51.100.1") {
  return sendLoginCode({ phone, ip });
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  process.env.SESSION_SECRET = "session-secret";
  delete process.env.SMS_PROVIDER;
  await connectMemoryMongo();
  // The unique phone index must exist before the duplicate-number test runs.
  await PhoneIdentity.init();
  await PhoneLoginChallenge.init();
});
afterAll(async () => {
  delete process.env.SESSION_SECRET;
  setOtpProvider(null);
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  sent.length = 0;
  setOtpProvider(recorder);
});
afterEach(() => {
  setOtpProvider(null);
  vi.restoreAllMocks();
});

describe("phone numbers", () => {
  it("accepts common formats and reads a bare 10-digit number as Indian", () => {
    expect(normalizePhone("98765 43210")).toBe("+919876543210");
    expect(normalizePhone("+91-98765-43210")).toBe("+919876543210");
    expect(normalizePhone("+919876543210")).toBe("+919876543210");
  });

  it("rejects anything else", () => {
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("12345")).toBeNull();
  });
});

describe("phone login codes", () => {
  it("sends nothing for a number that is not linked, but answers the same way", async () => {
    const result = await sendRequest("+919000000001");
    expect(result).toEqual({ ok: true });
    expect(sent).toHaveLength(0);
    expect(await PhoneLoginChallenge.countDocuments({})).toBe(0);
  });

  it("logs in with the code sent to a linked number", async () => {
    const user = await person("otp-login@example.com");
    await linkPhone(user.id, "9876500001");
    await sendRequest("9876500001");
    expect(sent).toHaveLength(1);
    expect(sent[0].phone).toBe("+919876500001");
    const result = await verifyLoginCode({ phone: "9876500001", code: sent[0].code, ip: "198.51.100.1" });
    expect(result.user.id).toBe(user.id);
    expect(result.token.length).toBeGreaterThan(20);
    expect(await Session.countDocuments({ userId: user._id })).toBe(1);
  });

  it("a code works once", async () => {
    const user = await person("otp-once@example.com");
    await linkPhone(user.id, "9876500002");
    await sendRequest("9876500002");
    const code = sent[0].code;
    await verifyLoginCode({ phone: "9876500002", code });
    await expect(verifyLoginCode({ phone: "9876500002", code })).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("five wrong guesses use the code up, even if the right one comes next", async () => {
    const user = await person("otp-guess@example.com");
    await linkPhone(user.id, "9876500003");
    await sendRequest("9876500003");
    const right = sent[0].code;
    const wrong = right === "000000" ? "111111" : "000000";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(verifyLoginCode({ phone: "9876500003", code: wrong })).rejects.toBeInstanceOf(UnauthorizedError);
    }
    await expect(verifyLoginCode({ phone: "9876500003", code: right })).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("a code expires after 10 minutes", async () => {
    const user = await person("otp-expiry@example.com");
    await linkPhone(user.id, "9876500004");
    await sendRequest("9876500004");
    await PhoneLoginChallenge.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(verifyLoginCode({ phone: "9876500004", code: sent[0].code })).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("refuses a number that is already linked to another account", async () => {
    const first = await person("link-first@example.com");
    const second = await person("link-second@example.com");
    await linkPhone(first.id, "9876500005");
    const logged: string[] = [];
    const spy = vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(" "));
    });
    const started = await startPhone(second.id, "9876500005");
    spy.mockRestore();
    const code = /code=(\d{6})/.exec(logged.join(" "))?.[1] ?? "";
    await expect(confirmPhone(second.id, started.challengeId, code)).rejects.toBeInstanceOf(ConflictError);
    expect(await PhoneIdentity.countDocuments({ phone: "+919876500005" })).toBe(1);
  });
});

describe("rate limit on sends (3 per 10 minutes)", () => {
  it("allows three sends to one number, refuses the fourth, and counts every format of the number together", async () => {
    const user = await person("otp-rate-phone@example.com");
    await linkPhone(user.id, "9876500010");
    expect((await sendRequest("9876500010", "198.51.100.10")).ok).toBe(true);
    expect((await sendRequest("+91 98765 00010", "198.51.100.11")).ok).toBe(true);
    expect((await sendRequest("+91-9876500010", "198.51.100.12")).ok).toBe(true);
    const fourth = await sendRequest("+919876500010", "198.51.100.13");
    expect(fourth.ok).toBe(false);
    if (!fourth.ok) expect(fourth.retryAfter).toBeGreaterThan(0);
    expect(sent).toHaveLength(3);
  });

  it("allows three sends from one IP to different numbers, refuses the fourth", async () => {
    for (let index = 0; index < 3; index += 1) {
      expect((await sendRequest(`+9190000000${index}0`, "198.51.100.20")).ok).toBe(true);
    }
    const fourth = await sendRequest("+919000000040", "198.51.100.20");
    expect(fourth.ok).toBe(false);
    expect((await sendRequest("+919000000050", "198.51.100.21")).ok).toBe(true);
  });

  it("the route answers 429 with retry-after on the fourth send", async () => {
    const user = await person("otp-route@example.com");
    await linkPhone(user.id, "9876500020");
    const send = () =>
      authPost(
        new Request(`${origin}/api/auth/otp/send`, {
          method: "POST",
          headers: new Headers({ origin, "content-type": "application/json", "x-real-ip": "198.51.100.30" }),
          body: JSON.stringify({ phone: "9876500020" }),
        }),
      );
    for (let index = 0; index < 3; index += 1) expect((await send()).status).toBe(200);
    const blocked = await send();
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("the route logs in with a valid code and sets the session cookie", async () => {
    const user = await person("otp-route-verify@example.com");
    await linkPhone(user.id, "9876500021");
    await sendRequest("9876500021", "198.51.100.40");
    const response = await authPost(
      new Request(`${origin}/api/auth/otp/verify`, {
        method: "POST",
        headers: new Headers({ origin, "content-type": "application/json", "x-real-ip": "198.51.100.40" }),
        body: JSON.stringify({ phone: "9876500021", code: sent[0].code }),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("sid=");
  });
});

describe("production", () => {
  it("the mock sender refuses to run in production, so no code is ever logged there", async () => {
    setOtpProvider(null);
    const user = await person("otp-prod@example.com");
    await linkPhone(user.id, "9876500030");
    vi.stubEnv("NODE_ENV", "production");
    try {
      await expect(sendRequest("9876500030", "198.51.100.50")).rejects.toBeInstanceOf(InternalError);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
