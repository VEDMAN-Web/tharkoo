import { z } from "zod";
import { connectDb } from "@/lib/db";
import { cached, refreshPublicCache } from "@/lib/cache";
import { isAdminRole } from "@/lib/ui/site-content";
import { AuditRepository } from "@/server/audit";
import { ConflictError, ForbiddenError, parseInput } from "@/server/http";
import { Site } from "@/server/models";

const SITE_KEY = "default";
const CACHE_MS = 15_000;
const audit = new AuditRepository();

export const LAUNCH_SWITCHES = ["creditPurchasesOn", "videoCallsOn"] as const;
export type LaunchSwitchName = (typeof LAUNCH_SWITCHES)[number];
export type LaunchSwitches = Record<LaunchSwitchName, boolean>;

export const launchSwitchBodySchema = z.object({ name: z.enum(LAUNCH_SWITCHES), on: z.boolean() }).strict();

export const CREDITS_SOON_MESSAGE = "Credit purchases are coming soon. Nothing was charged.";
export const VIDEO_SOON_MESSAGE = "Video calls are coming soon. No credits were used.";

export function launchDefault(env: Record<string, string | undefined> = process.env): boolean {
  return env.LAUNCH_SWITCHES_DEFAULT === "on";
}

export async function readLaunchSwitches(): Promise<LaunchSwitches> {
  await connectDb();
  const site = await Site.findOne({ key: SITE_KEY })
    .select(LAUNCH_SWITCHES.join(" "))
    .lean<Partial<LaunchSwitches> | null>();
  const fallback = launchDefault();
  return {
    creditPurchasesOn: typeof site?.creditPurchasesOn === "boolean" ? site.creditPurchasesOn : fallback,
    videoCallsOn: typeof site?.videoCallsOn === "boolean" ? site.videoCallsOn : fallback,
  };
}

export async function launchSwitches(): Promise<LaunchSwitches> {
  return cached("launch-switches", CACHE_MS, readLaunchSwitches, ["site"]);
}

export async function assertCreditPurchasesOn() {
  if (!(await readLaunchSwitches()).creditPurchasesOn) throw new ConflictError(CREDITS_SOON_MESSAGE);
}

export async function assertVideoCallsOn() {
  if (!(await readLaunchSwitches()).videoCallsOn) throw new ConflictError(VIDEO_SOON_MESSAGE);
}

export async function setLaunchSwitch(input: { actorId: string; roles: readonly string[]; name: unknown; on: unknown; requestId: string }) {
  if (!isAdminRole([...input.roles])) throw new ForbiddenError("Only an admin can change this setting");
  const { name, on } = parseInput(launchSwitchBodySchema, { name: input.name, on: input.on });
  await connectDb();
  const before = await readLaunchSwitches();
  await Site.updateOne({ key: SITE_KEY }, { $set: { [name]: on } }, { upsert: true, strict: false });
  const after = await readLaunchSwitches();
  await audit.append({
    actorId: input.actorId,
    actorType: "admin",
    action: "settings.launch_switch.update",
    targetType: "site",
    targetId: SITE_KEY,
    requestId: input.requestId,
    before,
    after,
  });
  await refreshPublicCache();
  return after;
}
