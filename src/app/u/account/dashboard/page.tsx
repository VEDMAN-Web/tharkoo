import { Dashboard } from "@/components/vendor/VendorScreens";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Dashboard | Tharkoo",
  description: "Your Tharkoo dashboard.",
  path: "/u/account/dashboard/",
  index: false,
});

export default async function Page({ searchParams }: { searchParams: Promise<{ locked?: string }> }) {
  const sp = await searchParams;
  return <Dashboard locked={sp.locked === "1"} />;
}
