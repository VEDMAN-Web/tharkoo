import { InternalError } from "@/server/http";

export type RoomSide = "advertiser" | "buyer";

export interface VideoRoom {
  roomId: string;
  live: boolean;
}

export interface JoinInput {
  roomId: string;
  side: RoomSide;
  userName: string;
  expiresAt: Date;
}

export interface VideoRoomProvider {
  readonly name: "mock" | "daily";
  createRoom(input: { tourId: string; expiresAt: Date }): Promise<VideoRoom>;
  joinUrlFor(input: JoinInput): Promise<string | null>;
  deleteRoom(roomId: string): Promise<void>;
}

export const TOUR_BOOKED_MINUTES = 30;
export const TOUR_ROOM_GRACE_MINUTES = 10;
export const VIDEO_CALL_FAILED = "Video call could not start, please try again";

const DAILY_API = "https://api.daily.co/v1";
const DEFAULT_DOMAIN = "tharkoo.daily.co";
const REQUEST_TIMEOUT_MS = 10_000;

export function roomExpiry(startsAt: Date) {
  return new Date(startsAt.getTime() + (TOUR_BOOKED_MINUTES + TOUR_ROOM_GRACE_MINUTES) * 60_000);
}

export function callPagePath(tourId: string) {
  return `/u/account/tours/${tourId}/`;
}

const mockRooms: VideoRoomProvider = {
  name: "mock",
  createRoom: async ({ tourId }) => ({ roomId: `mock_${tourId}`, live: false }),
  joinUrlFor: async () => null,
  deleteRoom: async () => undefined,
};

function dailyConfig() {
  const key = (process.env.DAILY_API_KEY || "").trim();
  const domain = (process.env.DAILY_DOMAIN || DEFAULT_DOMAIN).trim().toLowerCase();
  if (!key || !/^[a-z0-9-]+\.daily\.co$/.test(domain)) {
    console.error("daily rooms: not configured");
    throw new InternalError(VIDEO_CALL_FAILED);
  }
  return { key, domain };
}

async function dailyCall(key: string, method: "POST" | "DELETE", path: string, body?: unknown): Promise<Response> {
  try {
    return await fetch(`${DAILY_API}${path}`, {
      method,
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    console.error("daily rooms: request failed", method);
    throw new InternalError(VIDEO_CALL_FAILED);
  }
}

function failed(res: Response): never {
  console.error("daily rooms: http status", res.status);
  throw new InternalError(VIDEO_CALL_FAILED);
}

const dailyRooms: VideoRoomProvider = {
  name: "daily",
  async createRoom({ tourId, expiresAt }) {
    const { key } = dailyConfig();
    const name = `tour-${tourId}`;
    const res = await dailyCall(key, "POST", "/rooms", {
      name,
      privacy: "private",
      properties: {
        exp: Math.floor(expiresAt.getTime() / 1000),
        max_participants: 2,
        enable_chat: false,
        eject_at_room_exp: true,
      },
    });
    if (!res.ok) failed(res);
    const made = (await res.json().catch(() => null)) as { name?: string } | null;
    return { roomId: typeof made?.name === "string" && made.name ? made.name : name, live: true };
  },
  async joinUrlFor({ roomId, side, userName, expiresAt }) {
    const { key, domain } = dailyConfig();
    const res = await dailyCall(key, "POST", "/meeting-tokens", {
      properties: {
        room_name: roomId,
        user_name: userName.slice(0, 80),
        exp: Math.floor(expiresAt.getTime() / 1000),
        is_owner: side === "advertiser",
      },
    });
    if (!res.ok) failed(res);
    const made = (await res.json().catch(() => null)) as { token?: string } | null;
    if (!made?.token) failed(res);
    return `https://${domain}/${encodeURIComponent(roomId)}?t=${encodeURIComponent(made.token)}`;
  },
  async deleteRoom(roomId) {
    try {
      const { key } = dailyConfig();
      const res = await dailyCall(key, "DELETE", `/rooms/${encodeURIComponent(roomId)}`);
      if (!res.ok && res.status !== 404) console.error("daily rooms: delete status", res.status);
    } catch {
      return;
    }
  },
};

export function videoRoomProvider(): VideoRoomProvider {
  return (process.env.VIDEO_TOUR_PROVIDER || "mock").trim() === "daily" ? dailyRooms : mockRooms;
}
