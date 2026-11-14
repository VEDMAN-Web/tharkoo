import { InternalError } from "@/server/http";

export interface VideoRoom {
  roomId: string;
  /** Where the advertiser and buyer join. Null for the mock: there is no room page yet. */
  joinUrl: string | null;
}

/** One implementation per hosted video vendor. Nothing here touches the wallet. */
export interface VideoRoomProvider {
  readonly name: "mock" | "daily";
  createRoom(input: { tourId: string }): VideoRoom;
  /** The join link for a room made earlier. Null when the vendor has none to give. */
  joinUrlFor(roomId: string): string | null;
}

const mockRooms: VideoRoomProvider = {
  name: "mock",
  createRoom: ({ tourId }) => ({ roomId: `mock_${tourId}`, joinUrl: null }),
  joinUrlFor: () => null,
};

/** TODO: Daily.co room API with DAILY_API_KEY. Not built: no account exists yet (Vedant to provide). */
const dailyRooms: VideoRoomProvider = {
  name: "daily",
  createRoom: () => {
    throw new InternalError("Live video rooms are not configured (needs DAILY_API_KEY)");
  },
  joinUrlFor: () => null,
};

export function videoRoomProvider(): VideoRoomProvider {
  return (process.env.VIDEO_TOUR_PROVIDER || "mock").trim() === "daily" ? dailyRooms : mockRooms;
}
