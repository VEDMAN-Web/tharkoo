import { LandingsEditor } from "@/components/admin/LandingsEditor";
import { connectDb } from "@/lib/db";
import { Site } from "@/server/models";

export const dynamic = "force-dynamic";

type StoredLanding = { h1?: string; intro?: string; faqs?: { q?: string; a?: string }[] };

export default async function LandingsAdminPage() {
  await connectDb().catch(() => null);
  const site = await Site.findOne({ key: "default" }).select("landings freeAdsPerWeek").lean<{ landings?: Record<string, StoredLanding>; freeAdsPerWeek?: number }>().catch(() => null);
  const landings = Object.entries(site?.landings || {}).map(([key, value]) => ({
    key,
    h1: value?.h1 || "",
    intro: value?.intro || "",
    question: value?.faqs?.[0]?.q || "",
    answer: value?.faqs?.[0]?.a || "",
  }));
  return <LandingsEditor landings={landings} freeAds={typeof site?.freeAdsPerWeek === "number" ? site.freeAdsPerWeek : 3} />;
}
