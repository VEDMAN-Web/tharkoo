import { ComingSoon } from "@/components/account/AccountTools";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Alerts | Tharkoo",
  description: "Saved searches will live here.",
  path: "/u/account/alerts/",
  index: false,
});

export default function Page() {
  return <ComingSoon title="Alerts" body="Saved searches will live here." href="/search/" label="Search listings" />;
}
