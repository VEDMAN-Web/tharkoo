import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { phoneDigits, SUPPORT_PHONE } from "@/lib/support";
import { TRUST } from "@/content/trust";
import { hasPlaceholder } from "@/components/new/legal-copy";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { loginCodeWarning } from "@/server/auth/email-code";
import { readMoneySettings } from "@/server/billing/money-settings";
import { demoAdCounts, demoFilter } from "@/server/listings/demo-ads";
import { Listing, Page, PageLayout, Site, SiteMedia, User } from "@/server/models";
import { STAFF_ROLE_NAMES } from "@/server/models/identity";
import { NotFoundError } from "@/server/http";

export const MANUAL_KEYS = ["junkAdsChecked", "bannerChecked", "paidPostingDecided"] as const;
export type ManualKey = (typeof MANUAL_KEYS)[number];
/** Rows that cannot be ticked by hand, but where staff can say "Keep as is" (stored on the same record, audited, with Undo). */
export const KEEP_KEYS = ["supportPhoneKept"] as const;
export type KeepKey = (typeof KEEP_KEYS)[number];
type TickKey = ManualKey | KeepKey;

export type ChecklistRow = {
  id: string;
  title: string;
  detail: string;
  done: boolean;
  href: string;
  manual: ManualKey | null;
  /** "Keep as is" on a row that can never be ticked by a real check. */
  keep?: { key: KeepKey; kept: boolean };
  /** The first ad that looks like junk, so "Not junk" can name it. */
  junkAd?: { id: string; title: string };
};

export type ChecklistInputs = {
  staffNames: string[];
  mockPaymentsOn: boolean;
  paidPostingOn: boolean;
  postingFee: number;
  demoActive: number;
  junkTitles: string[];
  /** The ids of the ads in junkTitles, in the same order. Ads marked "Not junk" are left out of both lists. */
  junkIds?: string[];
  supportPhone: string;
  placeholderPages: string[];
  grievancePublished: boolean;
  bannerChangedAt: Date | null;
  pictures: number;
  picturesToCheck: number;
  loginCodeWarning: string | null;
  siteHidden: boolean;
  ticks: Partial<Record<TickKey, { at?: Date; by?: string } | null>>;
};

const DAY_WORDS = { day: "numeric", month: "short" } as const;

export function nationalDigits(phone: string): string {
  const digits = phoneDigits(phone);
  return digits.length > 10 && digits.startsWith("91") ? digits.slice(2) : digits;
}

export function looksLikeJunk(title: string): boolean {
  const clean = title.trim();
  if (clean.length === 0) return true;
  if (clean.length < 4) return true;
  return !/[aeiou]/i.test(clean) || /^(.)\1{3,}$/.test(clean);
}

export function dayLabel(date: Date): string {
  return date.toLocaleDateString("en-IN", { ...DAY_WORDS, timeZone: "Asia/Kolkata" });
}

export function placeholderPagesIn(pages: { name: string; text: string }[]): string[] {
  return pages.filter((page) => hasPlaceholder(page.text)).map((page) => page.name);
}

export function buildChecklist(input: ChecklistInputs): ChecklistRow[] {
  const national = nationalDigits(input.supportPhone);
  const junk = input.junkTitles.filter(looksLikeJunk);
  const firstJunk = input.junkTitles.findIndex(looksLikeJunk);
  const tick = (key: TickKey) => Boolean(input.ticks[key]);
  const placeholders = input.placeholderPages;
  return [
    {
      id: "staff",
      title: "Staff sign-in works",
      detail: input.staffNames.length ? input.staffNames.join(", ") : "No staff account has been made yet",
      done: input.staffNames.length > 0,
      href: "/admin/team/",
      manual: null,
    },
    {
      id: "test-payments",
      title: "Test payments OFF and a real gateway connected",
      detail: input.mockPaymentsOn ? "Test payments are ON today" : "Test payments are off",
      done: !input.mockPaymentsOn,
      href: "/admin/prices/",
      manual: null,
    },
    {
      id: "paid-posting",
      title: "Decide paid posting",
      detail: input.paidPostingOn ? `${input.postingFee} credits for each new ad, on now` : "Posting is free now",
      done: tick("paidPostingDecided"),
      href: "/admin/prices/",
      manual: "paidPostingDecided",
    },
    {
      id: "demo-ads",
      title: "End demo ads, or keep them",
      detail: input.demoActive > 0 ? `${input.demoActive.toLocaleString("en-IN")} demo ads are live` : "No demo ads are live",
      done: input.demoActive === 0,
      href: "/admin/ads/",
      manual: null,
    },
    {
      id: "junk-ads",
      title: "Remove junk test ads",
      detail: junk.length ? `${junk.length} look like junk, for example “${junk[0].slice(0, 30)}”` : "None look like junk",
      done: tick("junkAdsChecked") || input.junkIds !== undefined && junk.length === 0,
      href: "/admin/ads/",
      manual: "junkAdsChecked",
      ...(firstJunk >= 0 && input.junkIds?.[firstJunk] ? { junkAd: { id: input.junkIds[firstJunk], title: input.junkTitles[firstJunk] } } : {}),
    },
    {
      id: "support-phone",
      title: "Real 10-digit support phone",
      detail: `Now ${input.supportPhone} (${national.length} digits)`,
      done: national.length === 10 || tick("supportPhoneKept"),
      href: "/admin/settings/",
      manual: null,
      keep: { key: "supportPhoneKept", kept: national.length !== 10 && tick("supportPhoneKept") },
    },
    {
      id: "banner",
      title: "Banner picture checked against the content rules",
      detail: input.bannerChangedAt ? `Changed ${dayLabel(input.bannerChangedAt)}` : "Not published yet",
      done: tick("bannerChecked"),
      href: "/admin/page-builder/",
      manual: "bannerChecked",
    },
    {
      id: "photos",
      title: "Home, category and city photos with alt text",
      detail: input.picturesToCheck ? `${input.picturesToCheck} of ${input.pictures} pictures have a picture description nobody has checked` : `${input.pictures} pictures`,
      done: input.pictures > 0 && input.picturesToCheck === 0,
      href: "/admin/media/",
      manual: null,
    },
    {
      id: "legal",
      title: "Legal pages and grievance officer",
      detail: !input.grievancePublished ? "The grievance page is not published" : placeholders.length ? "A legal page still has a placeholder" : "Name and email set",
      done: input.grievancePublished && placeholders.length === 0,
      href: "/admin/pages/",
      manual: null,
    },
    {
      id: "login-email",
      title: "Login-code email test",
      detail: input.loginCodeWarning ? "No email or SMS provider can send a login code" : "A login code can be sent",
      done: !input.loginCodeWarning,
      href: "/admin/settings/",
      manual: null,
    },
    {
      id: "google",
      title: "Show the site to Google",
      detail: input.siteHidden ? "Do this last, on launch day: one switch in SEO" : "The site can be found on Google",
      done: !input.siteHidden,
      href: "/admin/seo/",
      manual: null,
    },
  ];
}

const JUNK_SCAN = 300;
const SITE_KEY = "default";

export async function loadChecklistInputs(): Promise<ChecklistInputs> {
  await connectDb();
  const demo = await demoFilter();
  const real = demo ? { $nor: [demo] } : {};
  const [money, demoCounts, staff, recent, pages, site, media, picturesToCheck, layout] = await Promise.all([
    readMoneySettings(),
    demoAdCounts(),
    User.find({ roles: { $in: [...STAFF_ROLE_NAMES] }, status: "active" }).select("displayName").sort({ createdAt: 1 }).limit(8).lean<{ displayName?: string }[]>(),
    Listing.find({ ...real, status: { $in: ["active", "pending"] }, notJunkAt: null }).sort({ createdAt: -1 }).limit(JUNK_SCAN).select("title").lean<{ _id: unknown; title?: string }[]>(),
    Page.find({ status: "published" }).select("slug body").lean<{ slug?: string; body?: string }[]>(),
    Site.findOne({ key: SITE_KEY }).select("launchChecklist").lean<{ launchChecklist?: ChecklistInputs["ticks"] } | null>(),
    SiteMedia.countDocuments({ trashedAt: null }),
    SiteMedia.countDocuments({ trashedAt: null, altAuto: true }),
    PageLayout.findOne({ key: "home", scope: "default" }).select("publishedAt").lean<{ publishedAt?: Date | null } | null>(),
  ]);
  const texts = [
    ...Object.entries(TRUST).map(([key, copy]) => ({ name: key === "safety" ? "The Safety page" : `The ${key.replace(/-/g, " ")} page`, text: copy.paragraphs.join("\n") })),
    ...pages.map((page) => ({ name: `The ${page.slug ?? "page"} page`, text: page.body ?? "" })),
  ];
  return {
    staffNames: staff.map((row) => row.displayName ?? "").filter(Boolean),
    mockPaymentsOn: money.mockPaymentsOn,
    paidPostingOn: money.paidPostingOn,
    postingFee: money.postingFeeCredits,
    demoActive: demoCounts.active,
    junkTitles: recent.map((row) => row.title ?? ""),
    junkIds: recent.map((row) => String(row._id)),
    supportPhone: SUPPORT_PHONE,
    placeholderPages: placeholderPagesIn(texts),
    grievancePublished: pages.some((page) => page.slug === "grievance"),
    bannerChangedAt: layout?.publishedAt ?? null,
    pictures: media,
    picturesToCheck,
    loginCodeWarning: loginCodeWarning(),
    siteHidden: process.env.SITE_NOINDEX === "true",
    ticks: site?.launchChecklist ?? {},
  };
}

export async function getLaunchChecklist(): Promise<ChecklistRow[]> {
  await connectDb();
  return buildChecklist(await loadChecklistInputs());
}

const TICK_LABELS: Record<TickKey, string> = {
  junkAdsChecked: "junk test ads checked",
  bannerChecked: "banner picture checked",
  paidPostingDecided: "paid posting decided",
  supportPhoneKept: "support phone kept as is",
};

type Doc = Record<string, unknown>;
const plain = <T,>(value: T): T => JSON.parse(JSON.stringify(value ?? null)) as T;

/** Ticks or unticks one row of the launch checklist. One audited write; Undo puts the whole checklist record back as it was. */
export async function tickChecklist(ctx: AdminCtx, key: string, done: boolean) {
  const known = [...MANUAL_KEYS, ...KEEP_KEYS] as readonly string[];
  if (!known.includes(key)) throw new NotFoundError("This row cannot be ticked");
  const manual = key as TickKey;
  const label = TICK_LABELS[manual];
  await connectDb();
  const start = plain((await Site.findOne({ key: SITE_KEY }).select("launchChecklist").lean<{ launchChecklist?: Doc } | null>())?.launchChecklist);
  return adminWrite(ctx, {
    perm: "settings.edit",
    action: done ? "launch.tick" : "launch.untick",
    target: { type: "site", id: "launch-checklist", label: "Launch checklist" },
    undo: { kind: "record.restore", windowKey: "edits" },
    before: async () => ({ [manual]: (start as Doc | null)?.[manual] ?? null }),
    apply: async () => {
      const value = done ? { at: new Date(), by: ctx.email } : null;
      await Site.updateOne({ key: SITE_KEY }, { $set: { [`launchChecklist.${manual}`]: value } }, { upsert: true, strict: false });
      const site = await Site.findOne({ key: SITE_KEY }).select("launchChecklist").lean<{ _id: unknown; launchChecklist?: Doc } | null>();
      const now = plain(site?.launchChecklist);
      return {
        after: { [manual]: value ? { by: ctx.email } : null },
        result: { key: manual, done },
        summary: `${done ? "Ticked" : "Unticked"} the “${label}” row`,
        undoData: { model: "Site", id: String(site?._id), restore: start ? { launchChecklist: start } : {}, unset: start ? [] : ["launchChecklist"], expect: { launchChecklist: now } },
      };
    },
  });
}

/** Says an ad is not junk, so the launch checklist stops naming it. Stored on the ad, audited, and Undo takes the mark off. */
export async function markNotJunk(ctx: AdminCtx, listingId: string, notJunk: boolean) {
  await connectDb();
  if (!Types.ObjectId.isValid(listingId)) throw new NotFoundError("Ad not found");
  const row = await Listing.findById(listingId).select("title notJunkAt").lean<{ title?: string; notJunkAt?: Date | null } | null>();
  if (!row) throw new NotFoundError("Ad not found");
  const title = row.title ?? "";
  const was = row.notJunkAt ? new Date(row.notJunkAt).toISOString() : null;
  return adminWrite(ctx, {
    perm: "settings.edit",
    action: notJunk ? "launch.not-junk" : "launch.junk-again",
    target: { type: "listing", id: listingId, label: title },
    undo: { kind: "record.restore", windowKey: "edits" },
    before: async () => ({ notJunkAt: was }),
    apply: async () => {
      const at = notJunk ? new Date() : null;
      await Listing.updateOne({ _id: listingId }, { $set: { notJunkAt: at } });
      const now = plain((await Listing.findById(listingId).select("notJunkAt").lean<{ notJunkAt?: Date | null } | null>())?.notJunkAt ?? null);
      return {
        after: { notJunkAt: at ? at.toISOString() : null },
        result: { title },
        summary: `${notJunk ? "Marked" : "Took the mark off"} the ad “${title.slice(0, 40)}” ${notJunk ? "as not junk" : "(not junk)"}`,
        undoData: { model: "Listing", id: listingId, restore: { notJunkAt: was }, unset: [], expect: { notJunkAt: now } },
      };
    },
  });
}
