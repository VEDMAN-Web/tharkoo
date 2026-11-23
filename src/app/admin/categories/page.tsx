import Link from "next/link";
import { Lock } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import type { EditorField } from "@/components/admin/category-fields/CategoryFieldsEditor";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { canEditSite } from "@/lib/ui/site-content";
import { loadCategoriesScreen } from "@/server/categories/screen";
import { readCategoryFields } from "./fields-service";
import { CategoriesScreen } from "./_screen/CategoriesScreen";
import { tabOf } from "./_screen/model";

export const dynamic = "force-dynamic";

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

/** Categories & fields (H8.51): one master-detail screen. `?c=` names the category and `?tab=` the tab, so links and Back work. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const identity = await getStaffFromHeaders();
  if (!canEditSite(identity.roles)) {
    return (
      <AdminShell title="Categories & fields" hasHeader>
        <div className="adm-card" style={{ padding: 40, textAlign: "center", display: "grid", gap: 8, justifyItems: "center" }} data-tk="no-access">
          <Lock aria-hidden="true" size={28} />
          <h2 style={{ margin: 0, fontSize: 16 }}>You cannot open Categories &amp; fields</h2>
          <p style={{ margin: 0, maxWidth: "44ch" }}>This screen is for admins. Ask an admin if you need it.</p>
          <Link href="/admin/" className="adm-btn adm-btn-quiet">Back to Dashboard</Link>
        </div>
      </AdminShell>
    );
  }
  const params = await searchParams;
  const slug = one(params.c).toLowerCase();
  const data = { ...(await loadCategoriesScreen(/^[a-z0-9-]{1,80}$/.test(slug) ? slug : "")), canVideo: identity.roles.includes("superadmin") };
  const loaded = data.detail ? await readCategoryFields(data.detail.slug) : null;
  const fields: EditorField[] = (loaded?.fields ?? []).map((field) => ({
    key: String(field.key),
    label: String(field.label ?? ""),
    filterLabel: String(field.filterLabel ?? ""),
    type: String(field.type ?? "text"),
    help: String(field.help ?? ""),
    placeholder: String(field.placeholder ?? ""),
    required: field.required === true,
    enabled: field.enabled !== false,
    filterable: field.filterable === true,
    maxPicks: typeof field.maxPicks === "number" ? field.maxPicks : null,
    optionCount: Array.isArray(field.options) ? field.options.length : 0,
  }));
  return (
    <AdminShell title="Categories & fields" hasHeader>
      <CategoriesScreen data={data} tab={tabOf(one(params.tab))} fields={fields} />
    </AdminShell>
  );
}
