import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as attachmentGET } from "@/app/api/support/attachments/[id]/route";
import { GET as userGET, POST as userPOST } from "@/app/api/support/[[...slug]]/route";
import { GET as deskGET, POST as deskPOST } from "@/app/api/admin/support/[[...slug]]/route";
import { hashToken } from "@/server/auth/http";
import { Session, User } from "@/server/models";
import { SupportTicket } from "@/server/models/support";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const origin = "http://127.0.0.1:4317";
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

interface Envelope<T> {
  status: number;
  body: { ok: boolean; data: T; error: { code: string; message?: string } | null };
}
interface Created {
  id: string;
}
interface ListRow {
  id: string;
  topicLabel: string;
  status: string;
  unread: boolean;
}
interface Thread {
  messages: { body: string; internal: boolean; attachments: string[] }[];
}
interface NoteRow {
  internal: boolean;
}
interface Queue {
  items: { id: string }[];
}

async function person(email: string, roles: string[] = ["user"]) {
  const user = await User.create({
    email,
    passwordHash: "hash",
    displayName: email.split("@")[0],
    dateOfBirth: new Date("1995-04-02"),
    attestedAdultAt: new Date(),
    emailVerifiedAt: new Date(),
    roles,
    verificationStatus: "unsubmitted",
    status: "active",
  });
  const token = `tok-${email}`;
  await Session.create({ userId: user._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 86_400_000) });
  return { id: user._id.toString(), cookie: `sid=${encodeURIComponent(token)}` };
}

interface CallInit {
  method?: string;
  cookie?: string;
  json?: unknown;
  form?: FormData;
}

function call(path: string, init: CallInit = {}) {
  const headers: Record<string, string> = { origin };
  if (init.cookie) headers.cookie = init.cookie;
  if (init.json !== undefined) headers["content-type"] = "application/json";
  return new NextRequest(`${origin}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.form ?? (init.json !== undefined ? JSON.stringify(init.json) : undefined),
  });
}

async function readEnvelope<T>(res: Response): Promise<Envelope<T>> {
  return { status: res.status, body: (await res.json()) as Envelope<T>["body"] };
}

async function userApi<T = unknown>(path: string, init: CallInit = {}): Promise<Envelope<T>> {
  const handler = init.method === "POST" ? userPOST : userGET;
  return readEnvelope<T>(await handler(call(path, init)));
}

async function deskApi<T = unknown>(path: string, init: CallInit = {}): Promise<Envelope<T>> {
  const handler = init.method === "POST" ? deskPOST : deskGET;
  return readEnvelope<T>(await handler(call(`/api/admin/support${path}`, init)));
}

async function openTicket(cookie: string, subject = "Cannot post an ad") {
  const created = await userApi<Created>("/api/support/tickets", {
    cookie,
    method: "POST",
    json: { topic: "my_ads", subject, body: "The publish button does nothing for me." },
  });
  expect(created.status).toBe(200);
  return created.body.data.id;
}

beforeAll(async () => {
  await connectMemoryMongo();
  await SupportTicket.init();
});
beforeEach(async () => {
  await clearMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

describe("owner routes", () => {
  it("opens a ticket, lists it, and reads the thread back", async () => {
    const ada = await person("ada@example.com");
    const id = await openTicket(ada.cookie);
    const list = await userApi<ListRow[]>("/api/support/tickets", { cookie: ada.cookie });
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ id, topicLabel: "My ads", status: "waiting_for_support", unread: false });
    const thread = await userApi<Thread>(`/api/support/tickets/${id}`, { cookie: ada.cookie });
    expect(thread.body.data.messages).toHaveLength(1);
  });

  it("returns not found to another person, so existence is never confirmed", async () => {
    const ada = await person("ada@example.com");
    const eve = await person("eve@example.com");
    const id = await openTicket(ada.cookie);
    const res = await userApi(`/api/support/tickets/${id}`, { cookie: eve.cookie });
    expect(res.status).toBe(404);
    expect(res.body.error?.code).toBe("NOT_FOUND");
  });

  it("refuses a close from a user with 403", async () => {
    const ada = await person("ada@example.com");
    const id = await openTicket(ada.cookie);
    const res = await userApi(`/api/support/tickets/${id}/close`, { cookie: ada.cookie, method: "POST" });
    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe("FORBIDDEN");
    expect((await SupportTicket.findById(id))?.status).toBe("waiting_for_support");
  });

  it("refuses a reply on a closed ticket with 409, and the owner can still read it", async () => {
    const ada = await person("ada@example.com");
    const admin = await person("admin@example.com", ["admin"]);
    const id = await openTicket(ada.cookie);
    const closed = await deskApi(`/tickets/${id}/close`, { cookie: admin.cookie, method: "POST" });
    expect(closed.status).toBe(200);
    const reply = await userApi(`/api/support/tickets/${id}/messages`, { cookie: ada.cookie, method: "POST", json: { body: "Still there?" } });
    expect(reply.status).toBe(409);
    expect(reply.body.error?.code).toBe("CONFLICT");
    expect((await userApi(`/api/support/tickets/${id}`, { cookie: ada.cookie })).status).toBe(200);
  });

  it("accepts a multipart ticket with a real screenshot and serves it only to the owner", async () => {
    const ada = await person("ada@example.com");
    const eve = await person("eve@example.com");
    const form = new FormData();
    form.append("topic", "report_problem");
    form.append("subject", "Broken photo");
    form.append("body", "This photo does not load on my ad page.");
    form.append("screenshots", new File([new Uint8Array(PNG)], "shot.png", { type: "image/png" }));
    const created = await userApi<Created>("/api/support/tickets", { cookie: ada.cookie, method: "POST", form });
    expect(created.status).toBe(200);
    const thread = await userApi<Thread>(`/api/support/tickets/${created.body.data.id}`, { cookie: ada.cookie });
    const [attachmentId] = thread.body.data.messages[0].attachments;
    expect(attachmentId).toBeTruthy();

    const params = { params: Promise.resolve({ id: attachmentId }) };
    const own = await attachmentGET(call(`/api/support/attachments/${attachmentId}`, { cookie: ada.cookie }), params);
    expect(own.status).toBe(200);
    expect(own.headers.get("content-type")).toBe("image/png");
    expect(own.headers.get("cache-control")).toBe("private, no-store");
    expect(own.headers.get("x-content-type-options")).toBe("nosniff");

    const other = await attachmentGET(call(`/api/support/attachments/${attachmentId}`, { cookie: eve.cookie }), params);
    expect(other.status).toBe(404);
    const anonymous = await attachmentGET(call(`/api/support/attachments/${attachmentId}`), params);
    expect(anonymous.status).toBe(401);
  });

  it("refuses a screenshot that is not a real image with 400", async () => {
    const ada = await person("ada@example.com");
    const form = new FormData();
    form.append("topic", "my_ads");
    form.append("subject", "Fake picture");
    form.append("body", "This file is not really a picture at all.");
    form.append("screenshots", new File([new Uint8Array(Buffer.from("not an image"))], "shot.png", { type: "image/png" }));
    const created = await userApi("/api/support/tickets", { cookie: ada.cookie, method: "POST", form });
    expect(created.status).toBe(400);
    expect(created.body.error?.code).toBe("VALIDATION_ERROR");
  });

  it("returns the unread count for the dashboard notice", async () => {
    const ada = await person("ada@example.com");
    const agent = await person("agent@example.com", ["support"]);
    const id = await openTicket(ada.cookie);
    expect((await userApi<{ unread: number }>("/api/support/unread", { cookie: ada.cookie })).body.data).toEqual({ unread: 0 });
    const reply = await deskApi(`/tickets/${id}/messages`, {
      cookie: agent.cookie,
      method: "POST",
      json: { body: "We are looking", internal: false },
    });
    expect(reply.status).toBe(200);
    expect((await userApi<{ unread: number }>("/api/support/unread", { cookie: ada.cookie })).body.data).toEqual({ unread: 1 });
  });
});

describe("staff routes", () => {
  it("refuses the desk to a plain user and to staff without a desk role", async () => {
    const plain = await person("plain@example.com");
    const trust = await person("trust@example.com", ["trust_safety"]);
    expect((await deskApi("/tickets", { cookie: plain.cookie })).status).toBe(403);
    expect((await deskApi("/tickets", { cookie: trust.cookie })).status).toBe(403);
    expect((await deskApi("/tickets")).status).toBe(401);
  });

  it("lets support staff reply, note, change status, close and reopen", async () => {
    const ada = await person("ada@example.com");
    const agent = await person("agent@example.com", ["support"]);
    const id = await openTicket(ada.cookie);

    const queue = await deskApi<Queue>("/tickets?status=active", { cookie: agent.cookie });
    expect(queue.body.data.items.map((row) => row.id)).toEqual([id]);

    const note = await deskApi<NoteRow>(`/tickets/${id}/messages`, {
      cookie: agent.cookie,
      method: "POST",
      json: { body: "Check the ad limit", internal: true },
    });
    expect(note.body.data.internal).toBe(true);

    const badStatus = await deskApi(`/tickets/${id}/status`, { cookie: agent.cookie, method: "POST", json: { status: "closed" } });
    expect(badStatus.status).toBe(400);

    const status = await deskApi(`/tickets/${id}/status`, { cookie: agent.cookie, method: "POST", json: { status: "waiting_for_user" } });
    expect(status.status).toBe(200);

    const close = await deskApi(`/tickets/${id}/close`, { cookie: agent.cookie, method: "POST" });
    expect(close.status).toBe(200);
    expect((await SupportTicket.findById(id))?.closedBy?.toString()).toBe(agent.id);

    const reopen = await deskApi(`/tickets/${id}/reopen`, { cookie: agent.cookie, method: "POST" });
    expect(reopen.body.data).toEqual({ status: "open" });
    expect((await SupportTicket.findById(id))?.status).toBe("open");
  });

  it("hides internal notes from the owner and shows them to staff", async () => {
    const ada = await person("ada@example.com");
    const agent = await person("agent@example.com", ["superadmin"]);
    const id = await openTicket(ada.cookie);
    await deskApi(`/tickets/${id}/messages`, { cookie: agent.cookie, method: "POST", json: { body: "Internal only", internal: true } });
    const owner = await userApi(`/api/support/tickets/${id}`, { cookie: ada.cookie });
    expect(JSON.stringify(owner.body.data)).not.toContain("Internal only");
    const staff = await deskApi(`/tickets/${id}`, { cookie: agent.cookie });
    expect(JSON.stringify(staff.body.data)).toContain("Internal only");
  });

  it("returns not found for an unknown ticket id on the desk", async () => {
    const agent = await person("agent@example.com", ["support"]);
    const res = await deskApi(`/tickets/${new mongoose.Types.ObjectId().toString()}`, { cookie: agent.cookie });
    expect(res.status).toBe(404);
  });
});
