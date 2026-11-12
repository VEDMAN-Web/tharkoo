import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { CollectionEditor } from "@/components/admin/CollectionEditor";
import { connectDb } from "@/lib/db";
import { Category } from "@/server/models";

export const dynamic = "force-dynamic";

export default async function Page() {
  await connectDb();
  const rows = await Category.find({ deletedAt: null }).select("slug name fields").sort({ order: 1, name: 1 }).lean();
  return (
    <AdminShell title="Categories">
      <section className="adm-card" style={{ marginBottom: 16 }} aria-labelledby="post-fields-h">
        <h2 id="post-fields-h" className="adm-field-label" style={{ fontSize: 16 }}>Post form fields</h2>
        <p className="adm-field-help">Choose a category to change the labels, help text, placeholders, required flags, order and options of its post-ad form.</p>
        <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "flex", flexWrap: "wrap", gap: 8 }}>
          {rows.map((row) => (
            <li key={row.slug}>
              <Link className="adm-btn adm-btn-ghost" href={`/admin/categories/${row.slug}/`}>
                {row.name} ({row.fields?.length ?? 0} fields)
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <p className="mb-3 t-small text-muted">Names, colours, home blurbs, showOnHome, homeCities drive the homepage blocks.</p>
      <CollectionEditor model="Category" title="Categories" />
    </AdminShell>
  );
}
