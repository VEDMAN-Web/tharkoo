import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as adminList } from "@/app/api/admin/list/route";
import { DELETE, GET, POST } from "@/app/api/auth/[[...slug]]/route";
import { sessionCookieHeader } from "@/server/auth/http";
import { bootstrapAdmin } from "@/server/auth/service";
import { AuditEvent, FeatureFlag, Session, User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const password = "password123";
const origin = "http://127.0.0.1:4317";

function person(email: string, extra: Record<string, unknown> = {}) {
  return {
    email,
    password,
    displayName: "Ada",
    dateOfBirth: "1995-04-02",
    acceptedTerms: true,
    attestedAdult: true,
    ...extra,
  };
}

async function call(method: string, pathname: string, body?: unknown, cookie?: string) {
  const headers = new Headers({ origin });
  if (body !== undefined) headers.set("content-type", "application/json");
  if (cookie) headers.set("cookie", cookie);
  const request = new Request(`${origin}/api/auth/${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (method === "GET") return GET(request);
  if (method === "DELETE") return DELETE(request);
  return POST(request);
}

function cookieOf(response: Response) {
  const line = response.headers.getSetCookie().find((value) => value.startsWith("sid="));
  const pair = line?.split(";")[0];
  if (!pair) throw new Error("missing session cookie");
  return pair;
}

function setNodeEnv(value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = value;
}

async function withLogs<T>(fn: (logs: string[]) => Promise<T>) {
  const logs: string[] = [];
  const spy = vi.spyOn(console, "info").mockImplementation((message?: unknown) => {
    logs.push(String(message));
  });
  try {
    return await fn(logs);
  } finally {
    spy.mockRestore();
  }
}

function mailToken(logs: string[]) {
  const line = logs.find((entry) => entry.startsWith("[mail-body]"));
  const match = line?.match(/token=([a-f0-9]{32,})/);
  if (!match?.[1]) throw new Error("mail token was not logged");
  return match[1];
}

function assertClean(body: unknown, secrets: string[]) {
  const text = JSON.stringify(body);
  expect(text).not.toContain("passwordHash");
  expect(text).not.toContain("tokenHash");
  for (const secret of secrets) expect(text).not.toContain(secret);
}

beforeAll(async () => {
  process.env.BCRYPT_ROUNDS = "4";
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});

afterAll(async () => {
  delete process.env.BCRYPT_ROUNDS;
  delete process.env.ADMIN_BOOTSTRAP_EMAIL;
  delete process.env.ADMIN_BOOTSTRAP_PASSWORD;
  await disconnectMemoryMongo();
});

beforeEach(async () => {
  delete process.env.ADMIN_BOOTSTRAP_EMAIL;
  delete process.env.ADMIN_BOOTSTRAP_PASSWORD;
  await clearMemoryMongo();
});

describe("auth routes", () => {
  it("registers, verifies, logs in, and reads me", async () => {
    const email = "ada@example.com";
    const bodies: unknown[] = [];
    await withLogs(async (logs) => {
      const registered = await call("POST", "register", person(email));
      expect(registered.status).toBe(201);
      const registeredBody = await registered.json();
      bodies.push(registeredBody);
      expect(registeredBody.data.userId).toBeTruthy();
      const token = mailToken(logs);
      const verified = await call("POST", "verify-email", { token });
      expect(verified.status).toBe(200);
      bodies.push(await verified.json());
      const loggedIn = await call("POST", "login", { email, password });
      expect(loggedIn.status).toBe(200);
      const loggedBody = await loggedIn.json();
      bodies.push(loggedBody);
      expect(loggedBody.data.user.email).toBe(email);
      const cookie = cookieOf(loggedIn);
      expect(cookie).toBeTruthy();
      const header = loggedIn.headers.getSetCookie()[0] ?? "";
      expect(header).toMatch(/HttpOnly/);
      expect(header).toMatch(/SameSite=Lax/);
      expect(header).toMatch(/Path=\//);
      expect(header).not.toMatch(/Secure/);
      const me = await call("GET", "me", undefined, cookie);
      expect(me.status).toBe(200);
      const meBody = await me.json();
      bodies.push(meBody);
      expect(meBody.data.user.email).toBe(email);
      expect(meBody.data.verification.status).toBe("unsubmitted");
      expect(meBody.data.permissions).toContain("listings.write");
      const loggedOut = await call("POST", "logout", undefined, cookie);
      expect(loggedOut.status).toBe(200);
      bodies.push(await loggedOut.json());
      expect((await call("GET", "me", undefined, cookie)).status).toBe(401);
      assertClean(bodies, [token, password]);
    });
  });

  it("sets Secure on the session cookie in production", () => {
    expect(sessionCookieHeader("abc", true)).toMatch(/Secure/);
    expect(sessionCookieHeader("abc", true)).toMatch(/HttpOnly/);
    expect(sessionCookieHeader("abc", true)).toMatch(/SameSite=Lax/);
    expect(sessionCookieHeader("abc", true)).toMatch(/Path=\//);
  });

  it("returns 429 on the 21st wrong password and keeps the counter in Mongo", async () => {
    const email = "lock@example.com";
    await withLogs(async (logs) => {
      await call("POST", "register", person(email));
      await call("POST", "verify-email", { token: mailToken(logs) });
    });
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const failed = await call("POST", "login", { email, password: "wrong-password" });
      expect(failed.status).toBe(401);
    }
    const blocked = await call("POST", "login", { email, password: "wrong-password" });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    const body = await blocked.json();
    expect(body.error.code).toBe("RATE_LIMITED");
    const doc = await mongoose.connection.collection("auth_rate_limits").findOne({ key: `login:${email}` });
    expect(doc?.count).toBe(21);
  });

  it("revokes every session when the password is reset", async () => {
    const email = "reset@example.com";
    let resetToken = "";
    const first = await withLogs(async (logs) => {
      await call("POST", "register", person(email));
      await call("POST", "verify-email", { token: mailToken(logs) });
      return call("POST", "login", { email, password });
    });
    const second = await call("POST", "login", { email, password });
    expect((await call("GET", "me", undefined, cookieOf(first))).status).toBe(200);
    expect((await call("GET", "me", undefined, cookieOf(second))).status).toBe(200);
    await withLogs(async (logs) => {
      const forgot = await call("POST", "forgot-password", { email });
      expect(forgot.status).toBe(200);
      expect(await forgot.json()).toMatchObject({ data: { ok: true } });
      resetToken = mailToken(logs);
    });
    const reset = await call("POST", "reset-password", { token: resetToken, password: "new-password-9" });
    expect(reset.status).toBe(200);
    assertClean(await reset.json(), [resetToken, "new-password-9"]);
    expect((await call("GET", "me", undefined, cookieOf(first))).status).toBe(401);
    expect((await call("GET", "me", undefined, cookieOf(second))).status).toBe(401);
    const sessions = await Session.find({}).lean();
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions.every((session) => session.revokedAt)).toBe(true);
  });

  it("rotates the presented session on the next login", async () => {
    const email = "rotate@example.com";
    const first = await withLogs(async (logs) => {
      await call("POST", "register", person(email));
      await call("POST", "verify-email", { token: mailToken(logs) });
      return call("POST", "login", { email, password });
    });
    const second = await call("POST", "login", { email, password }, cookieOf(first));
    expect((await call("GET", "me", undefined, cookieOf(first))).status).toBe(401);
    expect((await call("GET", "me", undefined, cookieOf(second))).status).toBe(200);
    const listed = await call("GET", "sessions", undefined, cookieOf(second));
    const listedBody = await listed.json();
    expect(JSON.stringify(listedBody)).not.toContain("tokenHash");
    expect(listedBody.data.sessions).toHaveLength(1);
    expect(listedBody.data.sessions[0].current).toBe(true);
    const removed = await call("DELETE", `sessions/${listedBody.data.sessions[0].id}`, undefined, cookieOf(second));
    expect(removed.status).toBe(200);
    expect((await call("GET", "me", undefined, cookieOf(second))).status).toBe(401);
  });

  it("rejects a mismatched origin and an underage registration", async () => {
    const headers = new Headers({ origin: "https://evil.example", "content-type": "application/json" });
    const request = new Request(`${origin}/api/auth/login`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email: "ada@example.com", password }),
    });
    const blocked = await POST(request);
    expect(blocked.status).toBe(403);
    expect((await blocked.json()).error.code).toBe("FORBIDDEN");

    const young = await call("POST", "register", person("young@example.com", { dateOfBirth: "2015-01-01" }));
    expect(young.status).toBe(403);
    expect((await young.json()).error.code).toBe("VERIFICATION_REQUIRED");
  });

  it("logs a phone code and confirms it without returning the code", async () => {
    const email = "phone@example.com";
    const cookie = await withLogs(async (logs) => {
      await call("POST", "register", person(email));
      await call("POST", "verify-email", { token: mailToken(logs) });
      return cookieOf(await call("POST", "login", { email, password }));
    });
    const started = await withLogs(async (logs) => {
      const response = await call("POST", "phone/start", { phone: "+919800011122" }, cookie);
      expect(response.status).toBe(200);
      const body = await response.json();
      const code = logs.find((line) => line.startsWith("[phone-otp]"))?.match(/code=(\d{6})/)?.[1];
      expect(code).toBeTruthy();
      expect(body.data.dev).toBe(true);
      expect(JSON.stringify(body)).not.toContain(code);
      return { challengeId: body.data.challengeId as string, code: code as string };
    });
    const confirmed = await call(
      "POST",
      "phone/confirm",
      { challengeId: started.challengeId, code: started.code },
      cookie,
    );
    expect(confirmed.status).toBe(200);
    expect(await confirmed.json()).toMatchObject({ data: { phoneVerified: true } });
  });

  it("returns 403 from the admin API for role user and allows a staff role", async () => {
    const email = "member@example.com";
    const cookie = await withLogs(async (logs) => {
      await call("POST", "register", person(email));
      await call("POST", "verify-email", { token: mailToken(logs) });
      return cookieOf(await call("POST", "login", { email, password }));
    });
    const denied = await adminList(new NextRequest(`${origin}/api/admin/list`, { headers: { cookie } }));
    expect(denied.status).toBe(403);

    await User.updateOne({ email }, { $set: { roles: ["superadmin"] } });
    const staffCookie = cookieOf(await call("POST", "login", { email, password }));
    const allowed = await adminList(
      new NextRequest(`${origin}/api/admin/list`, { headers: { cookie: staffCookie } }),
    );
    expect(allowed.status).toBe(400);
  });

  it("bootstraps one superadmin and does not store the password in the audit log", async () => {
    process.env.ADMIN_BOOTSTRAP_EMAIL = "bootstrap-admin@example.com";
    process.env.ADMIN_BOOTSTRAP_PASSWORD = "bootstrap-secret";
    expect(await bootstrapAdmin()).toBe("created");
    expect(await bootstrapAdmin()).toBe("skipped");
    const users = await User.find().select("+passwordHash");
    expect(users).toHaveLength(1);
    expect(users[0]?.roles).toEqual(["superadmin"]);
    expect(users[0]?.emailVerifiedAt).toBeTruthy();
    const events = await AuditEvent.find({ action: "admin.bootstrap" }).lean();
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events[0])).not.toContain("bootstrap-secret");
    expect(JSON.stringify(events[0])).not.toContain("passwordHash");
  });
});

describe("removed cursor identity", () => {
  it("leaves no cursor identity files and no imports of them", () => {
    expect(existsSync(path.join(process.cwd(), "cursor"))).toBe(false);
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name === ".next" || name === "graphify-out") continue;
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx|js|mjs)$/.test(name)) continue;
        if (readFileSync(full, "utf8").includes("cursor/identity")) hits.push(full);
      }
    };
    walk(path.join(process.cwd(), "src"));
    expect(hits).toEqual([]);
  });
});

describe("phone otp stays off in production until the flag is on", () => {
  it("refuses without the flag and omits the dev flag when the flag is on", async () => {
    const email = "prod-phone@example.com";
    const previousEnv = process.env.NODE_ENV;
    const previousSite = process.env.NEXT_PUBLIC_SITE_URL;
    const cookie = await withLogs(async (logs) => {
      await call("POST", "register", person(email));
      await call("POST", "verify-email", { token: mailToken(logs) });
      return cookieOf(await call("POST", "login", { email, password }));
    });
    setNodeEnv("production");
    process.env.NEXT_PUBLIC_SITE_URL = origin;
    try {
      const refused = await call("POST", "phone/start", { phone: "+919800011122" }, cookie);
      expect(refused.status).toBe(403);
      await FeatureFlag.create({ key: "phone-otp", label: "Phone codes stay in test mode", enabled: true });
      await withLogs(async (logs) => {
        const response = await call("POST", "phone/start", { phone: "+919800011122" }, cookie);
        expect(response.status).toBe(200);
        const body = await response.json();
        const code = logs.find((line) => line.startsWith("[phone-otp]"))?.match(/code=(\d{6})/)?.[1];
        expect(code).toBeTruthy();
        expect(body.data.dev).toBeUndefined();
        expect(JSON.stringify(body)).not.toContain(code);
      });
    } finally {
      setNodeEnv(previousEnv);
      if (previousSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = previousSite;
    }
  });
});
