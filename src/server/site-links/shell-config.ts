import mongoose, { type Model } from "mongoose";
import { connectDb } from "@/lib/db";
import { refreshPublicCache } from "@/lib/cache";
import { AuditRepository } from "@/server/audit";
import { loadCatalogueImages, mergeCatalogueImages } from "@/server/site-links/catalogue-images";
import { ForbiddenError, ValidationError, parseInput } from "@/server/http";
import {
  defaultShellConfig,
  normaliseShellConfig,
  shellConfigSchema,
  unsafeShellLinks,
  type ShellConfig,
} from "@/server/site-links/shell-config-rules";

/**
 * H7.1: the text, links and contact details of the new header, footer and support chat.
 * Admins and superadmins save them; every save is audited with the values before and after.
 * Stored in its own small collection so the Site model is not touched.
 */

const SETTING_KEY = "default";
const audit = new AuditRepository();

interface ShellConfigRow {
  key: string;
  config?: unknown;
}

const ShellConfigModel: Model<ShellConfigRow> =
  (mongoose.models.ShellConfigSetting as Model<ShellConfigRow> | undefined) ??
  mongoose.model<ShellConfigRow>(
    "ShellConfigSetting",
    new mongoose.Schema<ShellConfigRow>(
      { key: { type: String, required: true, unique: true }, config: mongoose.Schema.Types.Mixed },
      { collection: "shell_config_settings", versionKey: false },
    ),
  );

/** The config as saved on Menus and footer and Support chat, with nothing added. The editors start from this, so a save never copies the new pictures into the old rows. */
export async function readStoredShellConfig(): Promise<ShellConfig> {
  await connectDb();
  const row = await ShellConfigModel.findOne({ key: SETTING_KEY }).lean<ShellConfigRow | null>();
  return normaliseShellConfig(row?.config);
}

/**
 * The config in force now, for the public pages. Never throws for a stored value that is broken: each field falls back to its default.
 * The pictures set in the new boxes on Categories and Cities (H8.39) come first, slot by slot; the old rows fill what they leave empty (H7.160).
 */
export async function readShellConfig(): Promise<ShellConfig> {
  await connectDb();
  const stored = await readStoredShellConfig();
  let fresh: Awaited<ReturnType<typeof loadCatalogueImages>> = [];
  try {
    fresh = await loadCatalogueImages();
  } catch (error) {
    console.error("shell.catalogue_images_failed", error instanceof Error ? error.message : error);
  }
  return fresh.length ? { ...stored, media: { images: mergeCatalogueImages(stored.media.images, fresh) } } : stored;
}

/** Admin or superadmin. Validates, rejects unsafe links, stores, audits and refreshes the public cache. */
export async function saveShellConfig(input: { actorId: string; roles: readonly string[]; config: unknown; requestId: string }) {
  await connectDb();
  if (!input.roles.some((role) => role === "admin" || role === "superadmin")) {
    throw new ForbiddenError("Only an admin can change the header, footer or chat text");
  }
  const parsed = parseInput(shellConfigSchema, input.config);
  const next = normaliseShellConfig(parsed);
  const bad = unsafeShellLinks(next);
  if (bad.length) throw new ValidationError("Some links are not allowed", { links: bad });
  const before = await readStoredShellConfig();
  await ShellConfigModel.updateOne({ key: SETTING_KEY }, { $set: { config: next } }, { upsert: true });
  await audit.append({
    actorId: input.actorId,
    actorType: "admin",
    action: "settings.shell.update",
    targetType: "site",
    targetId: SETTING_KEY,
    requestId: input.requestId,
    before: { ...before },
    after: { ...next },
  });
  await refreshPublicCache();
  return next;
}

/** The defaults, for the admin "reset" view. Nothing is written by this call. */
export function shellConfigDefaults(): ShellConfig {
  return defaultShellConfig();
}
