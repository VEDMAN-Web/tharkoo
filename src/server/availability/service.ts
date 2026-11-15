import { z } from "zod";
import { connectDb } from "@/lib/db";
import { isAdminRole } from "@/lib/ui/site-content";
import { AuditRepository } from "@/server/audit";
import { ForbiddenError, parseInput } from "@/server/http";
import { AWAY_HOURS_MAX, AWAY_HOURS_MIN, DEFAULT_AWAY_HOURS, awayReason, callsAllowed, presenceStatus, type AwayReason, type PresenceStatus } from "./status";
import { AvailabilitySettings, VendorPresence } from "./models";

const audit = new AuditRepository();
const SETTINGS_KEY = "default";

export const availabilityBodySchema = z.object({ available: z.boolean() }).strict();
export const awayHoursBodySchema = z
  .object({ awayAfterHours: z.number().int().min(AWAY_HOURS_MIN).max(AWAY_HOURS_MAX) })
  .strict();

export interface OwnPresence {
  available: boolean;
  status: PresenceStatus;
  awayReason: AwayReason;
  callsAllowed: boolean;
  lastActivityAt: string | null;
  awayAfterHours: number;
}

/** The hours without activity before a seller shows Away. A missing value is the default (2). */
export async function readAwayHours(): Promise<number> {
  await connectDb();
  const row = await AvailabilitySettings.findOne({ key: SETTINGS_KEY }).lean<{ awayAfterHours?: number } | null>();
  return typeof row?.awayAfterHours === "number" ? row.awayAfterHours : DEFAULT_AWAY_HOURS;
}

/** Admins and superadmins only. Writes the setting and an audit entry with the value before and after. */
export async function setAwayHours(input: { actorId: string; roles: readonly string[]; awayAfterHours: unknown; requestId: string }) {
  if (!isAdminRole([...input.roles])) throw new ForbiddenError("Only an admin can change this setting");
  const { awayAfterHours } = parseInput(awayHoursBodySchema, { awayAfterHours: input.awayAfterHours });
  const before = await readAwayHours();
  await connectDb();
  await AvailabilitySettings.updateOne({ key: SETTINGS_KEY }, { $set: { awayAfterHours } }, { upsert: true });
  await audit.append({
    actorId: input.actorId,
    actorType: "admin",
    action: "settings.availability.update",
    targetType: "site",
    targetId: SETTINGS_KEY,
    requestId: input.requestId,
    before: { awayAfterHours: before },
    after: { awayAfterHours },
  });
  return { awayAfterHours };
}

function toOwn(row: { available?: boolean; lastActivityAt?: Date | null } | null, hours: number, now: number): OwnPresence {
  // A seller starts Available now: a missing switch counts as on. Only an explicit off is a manual Away.
  const available = row?.available !== false;
  const lastActivityAt = row?.lastActivityAt ? new Date(row.lastActivityAt) : null;
  const status = presenceStatus({ available, lastActivityAt }, now, hours);
  return {
    available,
    status,
    awayReason: awayReason({ available, lastActivityAt }, now, hours),
    callsAllowed: callsAllowed(status),
    lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
    awayAfterHours: hours,
  };
}

/** The signed-in seller's own switch and status. */
export async function readOwnPresence(userId: string, now: Date = new Date()): Promise<OwnPresence> {
  await connectDb();
  const [row, hours] = await Promise.all([
    VendorPresence.findOne({ userId }).lean<{ available?: boolean; lastActivityAt?: Date | null } | null>(),
    readAwayHours(),
  ]);
  return toOwn(row, hours, now.getTime());
}

/** Turns the switch on or off. Either way it counts as activity. */
export async function setOwnAvailable(userId: string, available: boolean, now: Date = new Date()): Promise<OwnPresence> {
  await connectDb();
  await VendorPresence.updateOne({ userId }, { $set: { available, lastActivityAt: now } }, { upsert: true });
  return readOwnPresence(userId, now);
}

/** Records activity from the panel. Only moves the activity time; the switch itself is not changed. */
export async function touchOwnPresence(userId: string, now: Date = new Date()): Promise<OwnPresence> {
  await connectDb();
  await VendorPresence.updateOne({ userId }, { $set: { lastActivityAt: now } }, { upsert: true });
  return readOwnPresence(userId, now);
}

/** What buyers may see about a seller: the status only, never the switch or the times. */
export async function publicStatus(userId: string, now: Date = new Date()): Promise<{ status: PresenceStatus; callsAllowed: boolean }> {
  await connectDb();
  const own = await readOwnPresence(userId, now);
  return { status: own.status, callsAllowed: own.callsAllowed };
}
