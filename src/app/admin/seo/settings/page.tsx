import { AdminShell } from "@/components/admin/AdminShell";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { Category } from "@/server/models";
import { connectDb } from "@/lib/db";
import { SeoTabs } from "../SeoTabs";
import { SettingsForm } from "./SettingsForm";
import { getSeoSettings } from "./store";

export const dynamic = "force-dynamic";

export default async function SeoSettingsPage() {
  await connectDb();
  const [identity, settings, categories] = await Promise.all([
    getStaffFromHeaders(),
    getSeoSettings(),
    Category.find({ enabled: { $ne: false }, deletedAt: null }).select("slug name").sort({ name: 1 }).limit(60).lean(),
  ]);
  return (
    <AdminShell title="robots, llms & schema">
      <SeoTabs current="/admin/seo/settings/" />
      <SettingsForm
        initial={settings}
        categories={categories.filter((row) => row.slug).map((row) => ({ id: String(row._id), slug: row.slug as string, name: row.name || (row.slug as string) }))}
        isSuperadmin={identity.roles.includes("superadmin")}
      />
    </AdminShell>
  );
}
