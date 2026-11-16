import { connectDb } from "@/lib/db";
import { refreshPublicCache } from "@/lib/cache";
import { brandLogoUrl, LOGO_DARK_DEFAULT, LOGO_LIGHT_DEFAULT } from "@/lib/brand";
import { AuditRepository } from "@/server/audit";
import { ForbiddenError, ValidationError } from "@/server/http";
import { Site } from "@/server/models";

const SITE_KEY = "default";
const audit = new AuditRepository();

export type LogoVariant = "light" | "dark";

/** The two logos in force: the saved address, or the one that ships with the site. */
export async function readLogos() {
  await connectDb();
  const site = await Site.findOne({ key: SITE_KEY }).select("logoUrl logoDarkUrl").lean<{ logoUrl?: string; logoDarkUrl?: string } | null>();
  return { light: brandLogoUrl(site?.logoUrl, LOGO_LIGHT_DEFAULT), dark: brandLogoUrl(site?.logoDarkUrl, LOGO_DARK_DEFAULT), savedLight: Boolean(site?.logoUrl), savedDark: Boolean(site?.logoDarkUrl) };
}

/**
 * Admin only. Saves one logo address ("" puts the shipped logo back) and writes an audit entry with the value before and after.
 * The address must be a path on this site or an https image.
 */
export async function setLogo(input: { actorId: string; roles: readonly string[]; variant: LogoVariant; url: string; requestId: string }) {
  if (!input.roles.some((role) => role === "admin" || role === "superadmin")) throw new ForbiddenError("Only an admin can change the logo");
  const url = input.url.trim();
  if (url && brandLogoUrl(url, "") !== url) throw new ValidationError("Use an image from the media library or an https address", { url: ["Not a usable image address"] });
  const field = input.variant === "dark" ? "logoDarkUrl" : "logoUrl";
  await connectDb();
  const before = await readLogos();
  await Site.updateOne({ key: SITE_KEY }, { $set: { [field]: url } }, { upsert: true, strict: false });
  await audit.append({
    actorId: input.actorId,
    actorType: "admin",
    action: "settings.logo.update",
    targetType: "site",
    targetId: SITE_KEY,
    requestId: input.requestId,
    before: { [field]: input.variant === "dark" ? before.dark : before.light },
    after: { [field]: url || (input.variant === "dark" ? LOGO_DARK_DEFAULT : LOGO_LIGHT_DEFAULT) },
  });
  await refreshPublicCache();
  return readLogos();
}
