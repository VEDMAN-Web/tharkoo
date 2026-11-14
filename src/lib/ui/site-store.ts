import { refreshPublicCache } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { assertNoDashes } from "@/server/content/dashes";
import { ForbiddenError, ValidationError } from "@/server/http";
import { Site, User } from "@/server/models";
import { defaultSiteContent, isAdminRole, readContent, sanitizeSiteContent, type SiteContent } from "@/lib/ui/site-content";
import { HOME_DESCRIPTION_STORED_MAX, HOME_TITLE_STORED_MAX } from "@/lib/ui/home-seo";

const audit = new AuditRepository();

function mirror(content: SiteContent) {
  return {
    searchPlaceholder: content.hero.searchPlaceholder,
    postCta: content.hero.postLabel,
    ageGateTitle: content.age.title,
    ageGateBody: `${content.age.lead} ${content.age.rest}`,
    ageYes: content.age.yes,
    ageNo: content.age.no,
    cookieBody: content.cookies.body,
    cookieAccept: content.cookies.accept,
    cookieNecessary: content.cookies.necessary,
    supportHours: content.support.hours,
    supportWhatsapp: content.support.whatsapp,
    supportTelegram: content.support.telegram,
    socialLinks: content.socials,
    footerLinks: content.footer.columns.flatMap((column) => column.links),
  };
}

export async function ensureHomepageDocument() {
  await connectDb();
  const existing = await Site.findOne({ key: "default" });
  const content = defaultSiteContent();
  if (!existing) {
    await Site.create({
      key: "default",
      name: "Tharkoo",
      tagline: "Tharkoo, premium classifieds in India.",
      legalName: "SparkBeta Tech",
      countryName: "India",
      ageGateEnabled: true,
      homepage: { content },
      ...mirror(content),
    });
    return;
  }
  const homepage = existing.homepage;
  const stored =
    homepage && typeof homepage === "object" && !Array.isArray(homepage)
      ? (homepage as { content?: unknown }).content
      : undefined;
  if (!stored || typeof stored !== "object") {
    content.support = {
      hours: existing.supportHours || "",
      whatsapp: existing.supportWhatsapp || "",
      telegram: existing.supportTelegram || "",
    };
    existing.set("homepage", {
      ...(homepage && typeof homepage === "object" && !Array.isArray(homepage) ? homepage : {}),
      content,
    });
    existing.markModified("homepage");
    await existing.save();
  }
}

async function writeContent(content: SiteContent, actorEmail: string, action: string, before: SiteContent) {
  await connectDb();
  await ensureHomepageDocument();
  const site = await Site.findOne({ key: "default" });
  if (!site) throw new ForbiddenError("Homepage is not ready");
  const homepage = site.homepage;
  const nextHomepage = {
    ...(homepage && typeof homepage === "object" && !Array.isArray(homepage) ? homepage : {}),
    content,
  };
  site.set("homepage", nextHomepage);
  site.markModified("homepage");
  Object.assign(site, mirror(content));
  await site.save();
  const actor = actorEmail ? await User.findOne({ email: actorEmail }).select("_id") : null;
  await audit.append({
    actorId: actor?._id?.toString() ?? null,
    actorType: "admin",
    action,
    targetType: "site",
    targetId: String(site._id),
    before: before as unknown as Record<string, unknown>,
    after: content as unknown as Record<string, unknown>,
    requestId: crypto.randomUUID(),
  });
  await refreshPublicCache();
  return content;
}

export async function applyHomepageChange(input: {
  roles: string[];
  email: string;
  content: unknown;
  reset?: boolean;
}) {
  if (!isAdminRole(input.roles)) throw new ForbiddenError("Only an admin can edit the homepage");
  await connectDb();
  const current = await Site.findOne({ key: "default" }).lean();
  const before = readContent(current?.homepage);
  if (input.reset) return writeContent(defaultSiteContent(), input.email, "site.homepage.reset", before);
  const parsed = sanitizeSiteContent(input.content);
  if (!parsed.ok) throw new ValidationError(parsed.message);
  return writeContent(parsed.content, input.email, "site.homepage.update", before);
}

/**
 * Saves the home page title and description from the Home page editor (H6.10).
 * It writes the same stored fields the public page reads (Site.homepage.content.seoTitle and seoDescription),
 * through applyHomepageChange, so the role check, audit entry and cache refresh are the same as the homepage save.
 */
export async function applyHomeSeoChange(input: { roles: string[]; email: string; seoTitle: string; seoDescription: string }) {
  if (!isAdminRole(input.roles)) throw new ForbiddenError("Only an admin can edit the homepage");
  const seoTitle = input.seoTitle.trim();
  const seoDescription = input.seoDescription.trim();
  if (!seoTitle) throw new ValidationError("Enter a page title", { seoTitle: ["Enter a page title"] });
  if (!seoDescription) throw new ValidationError("Enter a page description", { seoDescription: ["Enter a page description"] });
  if (seoTitle.length > HOME_TITLE_STORED_MAX) throw new ValidationError("The page title is too long", { seoTitle: ["Too long"] });
  if (seoDescription.length > HOME_DESCRIPTION_STORED_MAX) {
    throw new ValidationError("The page description is too long", { seoDescription: ["Too long"] });
  }
  assertNoDashes({ seoTitle, seoDescription });
  await connectDb();
  const current = await Site.findOne({ key: "default" }).lean();
  const content = { ...readContent(current?.homepage), seoTitle, seoDescription };
  return applyHomepageChange({ roles: input.roles, email: input.email, content });
}
