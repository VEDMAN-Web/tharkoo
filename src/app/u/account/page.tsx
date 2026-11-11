import { Dashboard } from "@/components/vendor/VendorScreens";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Your account | Tharkoo",
  description: "Your Tharkoo account.",
  path: "/u/account/",
  index: false,
});

export default function Page() {
  return <Dashboard />;
}
