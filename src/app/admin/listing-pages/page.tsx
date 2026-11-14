import { AdminShell } from "@/components/admin/AdminShell";
import { PageTitleEditor } from "@/components/admin/PageTitleEditor";
import { LayoutEditor } from "@/components/admin/layout-editor/LayoutEditor";
import { Notice } from "@/components/admin/ui";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { canonical } from "@/lib/seo";
import { sampleVarsFor, type PageTitleTarget } from "@/lib/seo/page-title-defaults";
import { isAdminRole } from "@/lib/ui/site-content";
import { getSite } from "@/lib/queries";
import { typesForPage } from "@/server/layout/blocks";
import { readPageTitle } from "@/server/seo/page-titles";
import { Category } from "@/server/models";

export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9-]{1,80}$/;
const URL_PATH = /^\/[a-zA-Z0-9\-._~/]{1,300}$/;

type Search = { searchParams: Promise<{ kind?: string; category?: string; url?: string }> };

/** Which stored title the chosen scope edits: the category template, or the exact address (H6.10b). */
function titleBlockFor(kind: string, category: string, live: string): { target: PageTitleTarget; address: string; help: string } {
  if (kind === "category") {
    return {
      target: { kind: "template", pageType: "category", categorySlug: category },
      address: live,
      help: "This sets the title for the pages of this one category. It replaces the all-category title for this category only.",
    };
  }
  if (kind === "url") {
    return {
      target: { kind: "url", path: live },
      address: live,
      help: "This sets the title for this one address. It wins over the category title for that address.",
    };
  }
  return {
    target: { kind: "template", pageType: "category", categorySlug: null },
    address: "/{category}/",
    help: "This sets the title for every category page that has no title of its own. City and district pages have their own titles under SEO, then Page titles.",
  };
}

/** Turns the picker's choice into the layout scope the service understands, or an error text. */
function pickScope(kind: string, category: string, url: string): { scope: string; live: string } | { error: string } {
  if (kind === "category") {
    if (!SLUG.test(category)) return { error: "Choose a category." };
    return { scope: `category:${category}`, live: `/${category}/` };
  }
  if (kind === "url") {
    const path = url.trim().startsWith("/") ? url.trim() : `/${url.trim()}`;
    if (!URL_PATH.test(path)) return { error: "Type a page address such as /property/surat/." };
    return { scope: `url:${path.endsWith("/") ? path : `${path}/`}`, live: path.endsWith("/") ? path : `${path}/` };
  }
  return { scope: "default", live: "/" };
}

export default async function ListingPagesAdmin({ searchParams }: Search) {
  const identity = await getStaffFromHeaders();
  if (!isAdminRole(identity.roles)) {
    return (
      <AdminShell title="Listing pages">
        <Notice kind="warn">Only an admin can edit listing pages.</Notice>
      </AdminShell>
    );
  }
  const query = await searchParams;
  const kind = query.kind === "category" || query.kind === "url" ? query.kind : "default";
  await connectDb();
  const categories = await Category.find({ deletedAt: null }).sort({ name: 1 }).select("slug name").lean<{ slug: string; name: string }[]>();
  const picked = pickScope(kind, query.category ?? "", query.url ?? "");
  const titleBlock = "error" in picked ? null : titleBlockFor(kind, query.category ?? "", picked.live);
  const titleValues = titleBlock ? await readPageTitle(titleBlock.target) : null;
  const site = titleBlock ? await getSite() : null;
  const categoryName = categories.find((cat) => cat.slug === query.category)?.name ?? "";
  return (
    <AdminShell title="Listing pages">
      <p className="mb-4 t-small text-muted">
        Edit the category, city and district pages. Pick which pages a layout covers: all listing pages, one category, or one exact address. A layout for an exact address wins over a category layout, which wins over the default. Save a draft, then publish.
      </p>
      <form method="get" className="adm-card" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 16 }}>
        <label className="adm-field">
          <span className="adm-field-label">Applies to</span>
          <select name="kind" className="adm-input" defaultValue={kind}>
            <option value="default">All listing pages (default)</option>
            <option value="category">One category</option>
            <option value="url">One exact address</option>
          </select>
        </label>
        <label className="adm-field">
          <span className="adm-field-label">Category</span>
          <select name="category" className="adm-input" defaultValue={query.category ?? ""}>
            <option value="">Choose a category</option>
            {categories.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </select>
        </label>
        <label className="adm-field">
          <span className="adm-field-label">Address</span>
          <input name="url" className="adm-input" placeholder="/property/surat/" defaultValue={query.url ?? ""} maxLength={300} />
        </label>
        <button type="submit" className="adm-btn">
          Open layout
        </button>
      </form>
      {titleBlock && titleValues ? (
        <div style={{ marginBottom: 16 }}>
          <PageTitleEditor
            key={JSON.stringify(titleBlock.target)}
            target={titleBlock.target}
            initial={{ seoTitle: titleValues.title, seoDescription: titleValues.description }}
            siteLabel={canonical(titleBlock.address).replace(/^https?:\/\//, "")}
            previewVars={titleBlock.target.kind === "template" ? sampleVarsFor(categoryName, site?.name || "Tharkoo") : null}
            help={titleBlock.help}
          />
        </div>
      ) : null}
      {"error" in picked ? (
        <Notice kind="warn">{picked.error}</Notice>
      ) : (
        <LayoutEditor key={picked.scope} pageKey="listing" scope={picked.scope} allowedTypes={typesForPage("listing")} previewHref={picked.live} seoHref="/admin/seo/" />
      )}
    </AdminShell>
  );
}
