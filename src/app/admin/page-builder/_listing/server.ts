import { can } from "@/lib/admin/perms";
import { canonical } from "@/lib/seo";
import { sampleVarsFor, type PageTitleTarget } from "@/lib/seo/page-title-defaults";
import type { SampleVars } from "@/lib/seo/landing";
import { getSite } from "@/lib/queries";
import { readPageTitle } from "@/server/seo/page-titles";
import { connectDb } from "@/lib/db";
import { categoryPath, placePath } from "@/lib/urls";
import { getLocationBySlug } from "@/lib/queries";
import type { AdminCtx } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { explain, type CopyField, type CopySource, type ListingCopyExplained } from "@/server/content/listing-copy";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { listingDefaultBlocks } from "@/server/layout/defaults/listing";
import { publish, saveDraft } from "@/server/layout/service";
import { Category, Listing, PageLayout } from "@/server/models";
import type { BlockBase } from "@/server/models/layout";
import type { HeaderProps } from "./model";

/**
 * H8.44 (A44): the Listing tab of the Page builder. It edits the heading and the intro template of the listing pages ("listingHeader")
 * for all listing pages or for one category, and says which source wins the words of one address. Drafts and publishing use the layout
 * service (drafts are validated, every publish goes through adminWrite and can be undone).
 */

const KEY = "listing";
const SLUG = /^[a-z0-9-]{1,80}$/;
const URL_PATH = /^\/[a-zA-Z0-9\-._~/]{1,300}$/;

export type ListingHeaderState = {
  scope: string;
  categoryName: string;
  header: HeaderProps;
  /** True when this category has no layout of its own yet: it shows the default one until it is published. */
  inherited: boolean;
  liveVersion: number;
  hasDraft: boolean;
  draftSavedAt: string | null;
};

export type ExplainedField = { field: CopyField; winner: { source: CopySource; text: string } | null; others: { source: CopySource; text: string }[] };
export type ExplainedAddress = { path: string; kind: "category" | "place"; mode: "legacy" | "content"; fields: ExplainedField[] };

const plain = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function allow(ctx: AdminCtx) {
  if (!can(ctx.roles, "pages.edit")) throw new ForbiddenError("Only an admin can edit the listing pages");
}

function propsOf(blocks: readonly BlockBase[] | null | undefined): HeaderProps {
  const found = (blocks ?? []).find((block) => block.type === "listingHeader") ?? listingDefaultBlocks().find((block) => block.type === "listingHeader");
  const props = (found?.props ?? {}) as Record<string, unknown>;
  return {
    h1Template: typeof props.h1Template === "string" && props.h1Template ? props.h1Template : "{h1}",
    introTemplate: typeof props.introTemplate === "string" ? props.introTemplate : "",
    showCount: props.showCount !== false,
    showUpdated: props.showUpdated !== false,
  };
}

async function categoryNameOf(scope: string): Promise<string> {
  if (scope === "default") return "";
  const slug = scope.slice("category:".length);
  if (!SLUG.test(slug)) throw new ValidationError("Choose a category.");
  const row = await Category.findOne({ slug, deletedAt: null }).select("name").lean<{ name: string } | null>();
  if (!row) throw new NotFoundError("That category was not found");
  return row.name;
}

function checkScope(scope: string) {
  if (scope !== "default" && !scope.startsWith("category:")) throw new ValidationError("Choose all listing pages or one category.");
}

/** The blocks a scope starts from: its own draft, else its own live layout, else the default layout, else today's built-in blocks. */
async function baseBlocks(scope: string): Promise<{ blocks: BlockBase[]; own: boolean }> {
  const own = await PageLayout.findOne({ key: KEY, scope }).lean();
  if (own && Array.isArray(own.draft) && own.draft.length > 0) return { blocks: plain(own.draft as BlockBase[]), own: true };
  if (own && own.publishedAt && Array.isArray(own.published) && own.published.length > 0) return { blocks: plain(own.published as BlockBase[]), own: true };
  if (scope !== "default") {
    const fallback = await PageLayout.findOne({ key: KEY, scope: "default" }).lean();
    const live = fallback?.publishedAt && Array.isArray(fallback.published) && fallback.published.length > 0 ? (fallback.published as BlockBase[]) : null;
    if (live) return { blocks: plain(live), own: false };
  }
  return { blocks: listingDefaultBlocks(), own: false };
}

export async function loadListingHeader(ctx: AdminCtx, scope: string): Promise<ListingHeaderState> {
  allow(ctx);
  checkScope(scope);
  await connectDb();
  const categoryName = await categoryNameOf(scope);
  const base = await baseBlocks(scope);
  const doc = await PageLayout.findOne({ key: KEY, scope }).lean();
  return {
    scope,
    categoryName,
    header: propsOf(base.blocks),
    inherited: !base.own,
    liveVersion: doc?.publishedAt ? doc.version : 0,
    hasDraft: Boolean(doc && Array.isArray(doc.draft) && doc.draft.length > 0),
    draftSavedAt: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}

function withHeader(blocks: readonly BlockBase[], header: HeaderProps): BlockBase[] {
  const present = blocks.some((block) => block.type === "listingHeader");
  const next = blocks.map((block) => (block.type === "listingHeader" ? { ...block, props: { ...block.props, ...header } } : block));
  if (present) return next;
  const fresh = listingDefaultBlocks().find((block) => block.type === "listingHeader") as BlockBase;
  return [{ ...fresh, props: { ...fresh.props, ...header } }, ...next];
}

/** Saves the heading and intro template as the draft of one scope. Nothing changes on the site until it is published. */
export async function saveListingHeaderDraft(ctx: AdminCtx, scope: string, header: HeaderProps) {
  allow(ctx);
  checkScope(scope);
  await connectDb();
  await categoryNameOf(scope);
  const base = await baseBlocks(scope);
  const saved = await saveDraft({ key: KEY, scope, blocks: withHeader(base.blocks, header), email: ctx.email, roles: ctx.roles });
  return { savedAt: new Date().toISOString(), version: saved.version };
}

/** Publishes the saved draft of one scope (audited, and it can be undone for 30 days by putting the earlier version back). */
export async function publishListingHeader(ctx: AdminCtx, scope: string, note?: string) {
  allow(ctx);
  checkScope(scope);
  await connectDb();
  const categoryName = await categoryNameOf(scope);
  const current = await PageLayout.findOne({ key: KEY, scope }).lean();
  if (!current) throw new NotFoundError("Save a draft first, then publish it.");
  const wasLive = current.publishedAt ? current.version : 0;
  const label = scope === "default" ? "Listing pages" : `Listing pages of ${categoryName}`;
  const done = await adminWrite(ctx, {
    perm: "pages.edit",
    action: "layout.publish",
    target: { type: "layout", id: `${KEY}/${scope}`, label },
    texts: [current.draft, note],
    ...(wasLive > 0 ? { undo: { kind: "layout.publish" as const, windowKey: "edits" as const } } : {}),
    before: async () => ({ version: current.version }),
    apply: async () => {
      const { version } = await publish({ key: KEY, scope, email: ctx.email, roles: ctx.roles, note }, { audit: false });
      return {
        after: { version },
        result: { version },
        undoData: { key: KEY, scope, restoreVersion: wasLive, atVersion: version },
        summary: `Published ${label} as version ${version}`,
      };
    },
  });
  return { version: done.result.version, eventId: done.eventId, canUndo: wasLive > 0 && done.eventId !== "" };
}

const titleCase = (slug: string) => slug.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

/** "Which text does this address use?" for a category page (/dating/) or a city or state page (/dating/surat/). */
export async function explainAddress(ctx: AdminCtx, address: string): Promise<ExplainedAddress> {
  allow(ctx);
  await connectDb();
  const parts = String(address ?? "").trim().split("?")[0].split("/").filter(Boolean).map((part) => part.toLowerCase());
  if (parts.length < 1 || parts.length > 2 || parts.some((part) => !SLUG.test(part))) throw new ValidationError("Type a category page such as /dating/ or a city page such as /dating/surat/.");
  const category = await Category.findOne({ slug: parts[0], deletedAt: null }).select("name slug").lean<{ _id: import("mongoose").Types.ObjectId; name: string; slug: string } | null>();
  if (!category) throw new NotFoundError(`There is no category called "${parts[0]}".`);
  const base = { categorySlug: category.slug, category: category.name, mode: undefined };
  let input;
  let path;
  if (parts.length === 1) {
    path = categoryPath(category.slug);
    const count = await Listing.countDocuments({ categoryId: category._id, status: "active" });
    input = { ...base, kind: "category" as const, path, count };
  } else {
    const place = await getLocationBySlug(parts[1]);
    if (!place) throw new NotFoundError(`There is no place called "${parts[1]}".`);
    path = placePath(category.slug, place.slug);
    const count = place.type === "city" ? await Listing.countDocuments({ categoryId: category._id, cityId: place.id, status: "active" }) : 0;
    input = { ...base, kind: "place" as const, path, place: place.name, state: place.stateSlug ? titleCase(place.stateSlug) : place.name, count };
  }
  const result: ListingCopyExplained = await explain(input);
  const fields = (["h1", "intro", "faqs", "title", "description"] as const).map((field) => {
    const value = result[field];
    const text = Array.isArray(value) ? value.map((row) => row.q).join(" | ") : String(value ?? "");
    const source = result.sources[field];
    return { field, winner: text ? { source, text } : null, others: result.candidates[field].filter((row) => row.source !== source) };
  });
  return { path, kind: input.kind, mode: result.mode, fields };
}

export type ListingTitleState = {
  target: PageTitleTarget;
  initial: { seoTitle: string; seoDescription: string };
  siteLabel: string;
  previewVars: SampleVars | null;
  help: string;
};

/** The Google title and description of one scope: the category template, or the exact address. Saved by the same action as SEO, Page titles. */
export async function loadListingTitle(ctx: AdminCtx, scope: string): Promise<ListingTitleState> {
  allow(ctx);
  await connectDb();
  let target: PageTitleTarget;
  let address: string;
  let help: string;
  let name = "";
  if (scope.startsWith("url:")) {
    address = scope.slice("url:".length);
    if (!URL_PATH.test(address)) throw new ValidationError("Type a page address such as /property/surat/.");
    target = { kind: "url", path: address };
    help = "This sets the title for this one address. It wins over the category title for that address.";
  } else if (scope.startsWith("category:")) {
    name = await categoryNameOf(scope);
    const slug = scope.slice("category:".length);
    address = `/${slug}/`;
    target = { kind: "template", pageType: "category", categorySlug: slug };
    help = "This sets the title for the pages of this one category. It replaces the all-category title for this category only.";
  } else {
    address = "/{category}/";
    target = { kind: "template", pageType: "category", categorySlug: null };
    help = "This sets the title for every category page that has no title of its own. City and district pages have their own titles under SEO, Page titles.";
  }
  const values = await readPageTitle(target);
  const site = await getSite();
  return {
    target,
    initial: { seoTitle: values.title, seoDescription: values.description },
    siteLabel: canonical(address).replace(/^https?:\/\//, ""),
    previewVars: target.kind === "template" ? sampleVarsFor(name, (site as { name?: string })?.name || "Tharkoo") : null,
    help,
  };
}
