import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { CategoryFieldsEditor, type EditorField } from "@/components/admin/category-fields/CategoryFieldsEditor";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { isAdminRole } from "@/lib/ui/site-content";
import { readCategoryFields } from "../fields-service";

export const dynamic = "force-dynamic";

export default async function CategoryFieldsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const identity = await getStaffFromHeaders();
  if (!isAdminRole(identity.roles)) {
    return (
      <AdminShell title="Post fields">
        <p>Only an admin can edit post fields.</p>
      </AdminShell>
    );
  }
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) notFound();
  const data = await readCategoryFields(slug);
  if (!data) notFound();
  const fields: EditorField[] = data.fields.map((field) => ({
    key: String(field.key),
    label: String(field.label ?? ""),
    type: String(field.type ?? "text"),
    help: String(field.help ?? ""),
    placeholder: String(field.placeholder ?? ""),
    required: field.required === true,
    options: Array.isArray(field.options) ? field.options.map(String) : [],
  }));
  return (
    <AdminShell title={`Post fields: ${data.name}`}>
      <p className="mb-3 t-small text-muted">
        <Link href="/admin/categories/" className="adm-link">All categories</Link>
      </p>
      <CategoryFieldsEditor slug={slug} categoryName={data.name} initial={fields} />
    </AdminShell>
  );
}
