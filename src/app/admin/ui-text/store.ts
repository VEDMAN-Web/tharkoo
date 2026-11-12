import { cached, invalidateTags } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { isAdminRole } from "@/lib/ui/site-content";
import { isTextKey, makeT, TEXT_DEFAULTS, TEXT_MAX, type UiTextKey, type UiTextMap } from "@/lib/ui/text";
import { AuditRepository } from "@/server/audit";
import { ForbiddenError, ValidationError } from "@/server/http";
import { UiText, User } from "@/server/models";
import { textDenied } from "@/server/shared/policy";

const audit = new AuditRepository();
export const TEXT_TAG = "layout:text";
const TTL_MS = 60_000;

async function loadOverrides(): Promise<UiTextMap> {
  await connectDb();
  const rows = await UiText.find({}).select("key value").lean();
  const out: UiTextMap = {};
  for (const row of rows) if (isTextKey(row.key) && row.value.trim()) out[row.key] = row.value;
  return out;
}

/** The stored overrides, cached under the tag `layout:text`. If the database cannot be read, the defaults are used. */
export async function textOverrides(): Promise<UiTextMap> {
  try {
    return await cached("ui-text:all", TTL_MS, loadOverrides, [TEXT_TAG], true);
  } catch (error) {
    console.error("UI text could not be read, using the defaults", error);
    return {};
  }
}

/** Server helper for pages: `const t = await uiTexts(); t("listing.more")`. */
export async function uiTexts() {
  return makeT(await textOverrides());
}

async function refresh() {
  invalidateTags([TEXT_TAG]);
  try {
    const { revalidatePath, revalidateTag } = await import("next/cache");
    revalidateTag(TEXT_TAG, { expire: 0 });
    revalidatePath("/", "layout");
  } catch {
    /* scripts and unit tests have no Next request store */
  }
}

function requireAdmin(roles: string[]) {
  if (!isAdminRole(roles)) throw new ForbiddenError("Only an admin can edit UI text");
}

async function actorId(email: string) {
  const user = email ? await User.findOne({ email }).select("_id") : null;
  return user?._id?.toString() ?? null;
}

async function record(email: string, key: string, before: string | null, after: string | null) {
  await audit.append({
    actorId: await actorId(email),
    actorType: "admin",
    action: "ui_text.update",
    targetType: "ui_text",
    targetId: key,
    before: { value: before },
    after: { value: after },
    requestId: crypto.randomUUID(),
  });
}

/** Checks one new text. Returns the cleaned value or throws a ValidationError with a plain message. */
export function checkText(key: string, raw: unknown): string {
  if (!isTextKey(key)) throw new ValidationError("Unknown text key");
  if (typeof raw !== "string") throw new ValidationError("Text must be a string");
  const value = raw.replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim();
  if (value.length < 1) throw new ValidationError("Text cannot be empty. Use Reset to default instead.");
  if (value.length > TEXT_MAX) throw new ValidationError(`Text must be ${TEXT_MAX} characters or fewer`);
  if (/[<>]/.test(value)) throw new ValidationError("Text cannot contain < or >");
  if (textDenied(value).denied) throw new ValidationError("This text uses a word that is not allowed on Tharkoo");
  return value;
}

/** Saves one override. A value equal to the default removes the override. */
export async function saveUiText(input: { roles: string[]; email: string; key: string; value: unknown }) {
  requireAdmin(input.roles);
  const value = checkText(input.key, input.value);
  await connectDb();
  const current = await UiText.findOne({ key: input.key });
  const before = current?.value ?? null;
  if (value === TEXT_DEFAULTS[input.key as UiTextKey]) {
    if (current) {
      await UiText.deleteOne({ key: input.key });
      await record(input.email, input.key, before, null);
    }
  } else if (before !== value) {
    await UiText.updateOne({ key: input.key }, { $set: { value, updatedBy: input.email } }, { upsert: true });
    await record(input.email, input.key, before, value);
  }
  await refresh();
  return { key: input.key, value };
}

/** Deletes the override so the default shows again. */
export async function resetUiText(input: { roles: string[]; email: string; key: string }) {
  requireAdmin(input.roles);
  if (!isTextKey(input.key)) throw new ValidationError("Unknown text key");
  await connectDb();
  const current = await UiText.findOne({ key: input.key });
  if (current) {
    await UiText.deleteOne({ key: input.key });
    await record(input.email, input.key, current.value, null);
  }
  await refresh();
  return { key: input.key, value: TEXT_DEFAULTS[input.key] };
}
