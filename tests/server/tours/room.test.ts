import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { roomLine } from "@/components/ad/tourLabels";
import { TOUR_BOOKED_MINUTES, TOUR_ROOM_GRACE_MINUTES, VIDEO_CALL_FAILED, callPagePath, roomExpiry, videoRoomProvider } from "@/server/tours/room";

type Call = { url: string; method: string; body: Record<string, unknown> | null; auth: string };

const calls: Call[] = [];
let replies: { status: number; body: unknown }[] = [];

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        url,
        method: String(init?.method),
        body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null,
        auth: String((init?.headers as Record<string, string>)?.authorization ?? ""),
      });
      const next = replies.shift() ?? { status: 200, body: {} };
      return new Response(JSON.stringify(next.body), { status: next.status, headers: { "content-type": "application/json" } });
    }),
  );
}

const expiresAt = new Date("2026-11-20T10:40:00Z");

beforeEach(() => {
  calls.length = 0;
  replies = [];
  process.env.VIDEO_TOUR_PROVIDER = "daily";
  process.env.DAILY_API_KEY = "test-key-not-real";
  process.env.DAILY_DOMAIN = "tharkoo.daily.co";
  stubFetch();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.VIDEO_TOUR_PROVIDER;
  delete process.env.DAILY_API_KEY;
  delete process.env.DAILY_DOMAIN;
});

describe("the mock provider", () => {
  it("makes no network call and gives no room link", async () => {
    delete process.env.VIDEO_TOUR_PROVIDER;
    const provider = videoRoomProvider();
    expect(provider.name).toBe("mock");
    expect(await provider.createRoom({ tourId: "t1", expiresAt })).toEqual({ roomId: "mock_t1", live: false });
    expect(await provider.joinUrlFor({ roomId: "mock_t1", side: "buyer", userName: "A", expiresAt })).toBeNull();
    await provider.deleteRoom("mock_t1");
    expect(calls).toEqual([]);
  });
});

describe("creating a Daily room", () => {
  it("posts a private two-person room that ends when the time is up", async () => {
    replies = [{ status: 200, body: { name: "tour-t1" } }];
    const room = await videoRoomProvider().createRoom({ tourId: "t1", expiresAt });
    expect(room).toEqual({ roomId: "tour-t1", live: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.daily.co/v1/rooms");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].auth).toBe("Bearer test-key-not-real");
    expect(calls[0].body).toEqual({
      name: "tour-t1",
      privacy: "private",
      properties: { exp: Math.floor(expiresAt.getTime() / 1000), max_participants: 2, sfu_switchover: 0.5, enable_chat: false, eject_at_room_exp: true },
    });
  });

  it("leaves recording off by not asking for it", async () => {
    replies = [{ status: 200, body: { name: "tour-t1" } }];
    await videoRoomProvider().createRoom({ tourId: "t1", expiresAt });
    const properties = (calls[0].body?.properties ?? {}) as Record<string, unknown>;
    expect(properties).not.toHaveProperty("enable_recording");
  });

  it("expires 30 booked minutes plus 10 minutes after the start", () => {
    const start = new Date("2026-11-20T10:00:00Z");
    expect(TOUR_BOOKED_MINUTES + TOUR_ROOM_GRACE_MINUTES).toBe(40);
    expect(roomExpiry(start).toISOString()).toBe("2026-11-20T10:40:00.000Z");
  });
});

describe("meeting tokens and the join link", () => {
  it("makes the advertiser an owner and the buyer a guest, with the same expiry", async () => {
    replies = [
      { status: 200, body: { token: "tok-a" } },
      { status: 200, body: { token: "tok b" } },
    ];
    const provider = videoRoomProvider();
    const advertiser = await provider.joinUrlFor({ roomId: "tour-t1", side: "advertiser", userName: "Asha", expiresAt });
    const buyer = await provider.joinUrlFor({ roomId: "tour-t1", side: "buyer", userName: "Ravi", expiresAt });
    expect(advertiser).toBe("https://tharkoo.daily.co/tour-t1?t=tok-a");
    expect(buyer).toBe("https://tharkoo.daily.co/tour-t1?t=tok%20b");
    const exp = Math.floor(expiresAt.getTime() / 1000);
    expect(calls[0].url).toBe("https://api.daily.co/v1/meeting-tokens");
    expect(calls[0].body).toEqual({ properties: { room_name: "tour-t1", user_name: "Asha", exp, is_owner: true } });
    expect(calls[1].body).toEqual({ properties: { room_name: "tour-t1", user_name: "Ravi", exp, is_owner: false } });
  });

  it("uses only a daily.co domain", async () => {
    process.env.DAILY_DOMAIN = "evil.example.com";
    await expect(videoRoomProvider().joinUrlFor({ roomId: "tour-t1", side: "buyer", userName: "R", expiresAt })).rejects.toThrow(VIDEO_CALL_FAILED);
    expect(calls).toEqual([]);
  });
});

describe("deleting a room", () => {
  it("sends a DELETE for the room", async () => {
    await videoRoomProvider().deleteRoom("tour-t1");
    expect(calls[0].method).toBe("DELETE");
    expect(calls[0].url).toBe("https://api.daily.co/v1/rooms/tour-t1");
  });

  it("ignores a room that is already gone, and never throws on other errors", async () => {
    replies = [{ status: 404, body: { error: "not-found" } }, { status: 500, body: {} }];
    await expect(videoRoomProvider().deleteRoom("tour-t1")).resolves.toBeUndefined();
    await expect(videoRoomProvider().deleteRoom("tour-t2")).resolves.toBeUndefined();
  });
});

describe("errors", () => {
  it("turns a Daily 4xx or 5xx into the friendly message and logs only the status", async () => {
    for (const status of [400, 401, 429, 500, 503]) {
      replies = [{ status, body: { error: "daily says no", info: "secret detail" } }];
      await expect(videoRoomProvider().createRoom({ tourId: "t1", expiresAt })).rejects.toThrow(VIDEO_CALL_FAILED);
    }
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).toContain("500");
    expect(logged).not.toContain("test-key-not-real");
    expect(logged).not.toContain("secret detail");
  });

  it("maps a token failure and a missing token the same way", async () => {
    replies = [{ status: 401, body: {} }];
    await expect(videoRoomProvider().joinUrlFor({ roomId: "r", side: "buyer", userName: "R", expiresAt })).rejects.toThrow(VIDEO_CALL_FAILED);
    replies = [{ status: 200, body: {} }];
    await expect(videoRoomProvider().joinUrlFor({ roomId: "r", side: "buyer", userName: "R", expiresAt })).rejects.toThrow(VIDEO_CALL_FAILED);
  });

  it("maps a network failure and a missing key the same way", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("down"))));
    await expect(videoRoomProvider().createRoom({ tourId: "t1", expiresAt })).rejects.toThrow(VIDEO_CALL_FAILED);
    delete process.env.DAILY_API_KEY;
    await expect(videoRoomProvider().createRoom({ tourId: "t1", expiresAt })).rejects.toThrow(VIDEO_CALL_FAILED);
  });
});

describe("the call page link", () => {
  it("is a path on this site and shows as a join link", () => {
    expect(callPagePath("abc")).toBe("/u/account/tours/abc/");
    expect(roomLine(callPagePath("abc"))).toEqual({ kind: "link", href: "/u/account/tours/abc/" });
  });
});
