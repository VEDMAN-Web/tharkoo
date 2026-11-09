import { Dashboard } from "@/components/vendor/VendorScreens";

export const metadata = { title: "Dashboard", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ locked?: string }> }) {
  const sp = await searchParams;
  return <Dashboard locked={sp.locked === "1"} />;
}
