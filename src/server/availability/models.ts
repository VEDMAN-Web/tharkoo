import { Schema, type Types } from "mongoose";
import { registerModel } from "@/server/models/register";

/**
 * H7.5: one row per seller. `lastActivityAt` is set by the switch, by the panel's activity ping, and by
 * the first page load. It is never written from a buyer's request.
 */
export interface VendorPresenceDoc {
  _id?: Types.ObjectId;
  userId: string;
  available: boolean;
  lastActivityAt: Date | null;
  /** H7.4c: the seller's Live chat switch. Off for every seller until they turn it on, so existing sellers start off. */
  liveChat?: boolean;
  updatedAt?: Date;
}

/** The admin setting: hours without activity before a seller shows Away. Key "default", one row. */
export interface AvailabilitySettingsDoc {
  _id?: Types.ObjectId;
  key: string;
  awayAfterHours: number;
  updatedAt?: Date;
}

const presenceSchema = new Schema<VendorPresenceDoc>(
  {
    userId: { type: String, required: true, unique: true, maxlength: 64 },
    available: { type: Boolean, default: true },
    lastActivityAt: { type: Date, default: null },
    liveChat: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: false, updatedAt: true }, collection: "vendor_presence" },
);

const settingsSchema = new Schema<AvailabilitySettingsDoc>(
  {
    key: { type: String, required: true, unique: true },
    awayAfterHours: { type: Number, default: 2, min: 1, max: 24 },
  },
  { timestamps: { createdAt: false, updatedAt: true }, collection: "availability_settings" },
);

export const VendorPresence = registerModel<VendorPresenceDoc>("VendorPresence", presenceSchema);
export const AvailabilitySettings = registerModel<AvailabilitySettingsDoc>("AvailabilitySettings", settingsSchema);
