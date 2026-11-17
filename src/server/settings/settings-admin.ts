import { connectDb } from "@/lib/db";
import { refreshPublicCache } from "@/lib/cache";
import type { AdminCtx } from "@/server/admin/context";
import { UNDO_WINDOW_DEFAULTS, type UndoWindowKey } from "@/server/admin/undo/registry";
import { adminWrite } from "@/server/admin/write";
import { can } from "@/lib/admin/perms";
import { ForbiddenError, ValidationError } from "@/server/http";
import { Site } from "@/server/models";
import { readEmergency, type EmergencyState } from "@/server/settings/emergency";

/**
 * H8.25 (A25): the Settings screen's data and the saves that are not emergency switches: the undo windows and "check ads after they go live".
 * Every write goes through adminWrite (admin permission, audit) and can be undone for the "settings" window.
 */

export const UNDO_WINDOW_KEYS = Object.keys(UNDO_WINDOW_DEFAULTS) as UndoWindowKey[];
const MIN_DAYS = 1;
const MAX_DAYS = 365;

export type SettingsData = {
  emergency: EmergencyState;
  undoWindows: Record<UndoWindowKey, number>;
  /** When "check ads after they go live" was turned on, or null when it is off. */
  postModerationSince: string | null;
  /** Display only: true when the site is hidden from search engines by the server setting. */
  hiddenFromSearch: boolean;
};

export async function readSettingsData(): Promise<SettingsData> {
  await connectDb();
  const [emergency, site] = await Promise.all([
    readEmergency(),
    Site.findOne({ key: "default" }).select("undoWindows postModerationSince").lean<{ undoWindows?: Partial<Record<UndoWindowKey, number>>; postModerationSince?: Date | null } | null>(),
  ]);
  const undoWindows = Object.fromEntries(UNDO_WINDOW_KEYS.map((key) => [key, typeof site?.undoWindows?.[key] === "number" ? site.undoWindows[key] : UNDO_WINDOW_DEFAULTS[key]])) as Record<UndoWindowKey, number>;
  return { emergency, undoWindows, postModerationSince: site?.postModerationSince ? new Date(site.postModerationSince).toISOString() : null, hiddenFromSearch: process.env.SITE_NOINDEX === "true" };
}

export type SettingsWrite = { eventId: string; undoUntil: string | null; summary: string };

function plain(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null)) as unknown;
}

/** Sets how long staff can undo each kind of change. Whole days, 1 to 365. */
export async function saveUndoWindows(ctx: AdminCtx, input: Partial<Record<UndoWindowKey, unknown>>): Promise<SettingsWrite & { windows: Record<UndoWindowKey, number> }> {
  await connectDb();
  const next: Record<string, number> = {};
  for (const key of UNDO_WINDOW_KEYS) {
    const raw = input[key];
    const days = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : Number.NaN;
    if (!Number.isInteger(days) || days < MIN_DAYS || days > MAX_DAYS) throw new ValidationError(`Days is a whole number from ${MIN_DAYS} to ${MAX_DAYS}.`);
    next[key] = days;
  }
  const written = await adminWrite(ctx, {
    perm: "settings.edit",
    action: "settings.undo_windows",
    target: { type: "site", id: "default", label: "Undo windows" },
    undo: { kind: "record.restore", windowKey: "settings" },
    before: async () => ({ ...(await readSettingsData()).undoWindows }),
    apply: async () => {
      const was = (await Site.findOne({ key: "default" }).lean()) as Record<string, unknown> | null;
      await Site.updateOne({ key: "default" }, { $set: { undoWindows: next } }, { upsert: true });
      const site = (await Site.findOne({ key: "default" }).lean()) as Record<string, unknown> | null;
      const had = Boolean(was && was.undoWindows);
      return {
        after: { ...next },
        result: next as Record<UndoWindowKey, number>,
        summary: "Changed the undo windows",
        undoData: { model: "Site", id: String(site?._id), restore: had ? { undoWindows: plain(was?.undoWindows) } : {}, unset: had ? [] : ["undoWindows"], expect: { undoWindows: plain(site?.undoWindows) } },
      };
    },
  });
  await refreshPublicCache("undo windows");
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: "Undo windows saved", windows: written.result };
}

/** Turns "check ads after they go live" on (from now) or off. The Ads to review screen counts ads published after that moment. */
export async function setPostModeration(ctx: AdminCtx, input: { on: unknown }): Promise<SettingsWrite & { since: string | null }> {
  await connectDb();
  if (typeof input.on !== "boolean") throw new ValidationError("Choose On or Off.");
  const since = input.on ? new Date() : null;
  const written = await adminWrite(ctx, {
    perm: "settings.edit",
    action: "settings.post_moderation",
    target: { type: "site", id: "default", label: "Check ads after they go live" },
    undo: { kind: "record.restore", windowKey: "settings" },
    before: async () => ({ postModerationSince: (await readSettingsData()).postModerationSince }),
    apply: async () => {
      const was = (await Site.findOne({ key: "default" }).lean()) as Record<string, unknown> | null;
      await Site.updateOne({ key: "default" }, { $set: { postModerationSince: since } }, { upsert: true });
      const site = (await Site.findOne({ key: "default" }).lean()) as Record<string, unknown> | null;
      const had = Boolean(was && "postModerationSince" in was);
      return {
        after: { postModerationSince: since ? since.toISOString() : null },
        result: since ? since.toISOString() : null,
        summary: since ? "Turned on: check ads after they go live" : "Turned off: check ads after they go live",
        undoData: { model: "Site", id: String(site?._id), restore: had ? { postModerationSince: plain(was?.postModerationSince) } : {}, unset: had ? [] : ["postModerationSince"], expect: { postModerationSince: plain(site?.postModerationSince) } },
      };
    },
  });
  await refreshPublicCache("post moderation");
  return { eventId: written.eventId, undoUntil: written.undoUntil, summary: input.on ? "Ads are now checked after they go live" : "Ads are no longer checked after they go live", since: written.result };
}

const SECRETISH = /key|token|secret|password|hash|salt|credential/i;

/** The value with every secret-looking key removed, however deep. Only the key name is judged, never the value. */
function withoutSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutSecrets);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => key === "key" || !SECRETISH.test(key)).map(([key, inner]) => [key, withoutSecrets(inner)]));
  return value;
}

/** The whole site record as JSON, read only, for a superadmin (raw.json). Secret-looking keys are left out. */
export async function readRawSite(roles: readonly string[]): Promise<string> {
  if (!can(roles, "raw.json")) throw new ForbiddenError("You do not have permission to do this");
  await connectDb();
  const site = (await Site.findOne({ key: "default" }).lean()) as Record<string, unknown> | null;
  return JSON.stringify(withoutSecrets(plain(site ?? {})), null, 2);
}
