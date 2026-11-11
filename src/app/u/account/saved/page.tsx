import { SavedList } from "@/components/vendor/VendorScreens";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Saved ads | Tharkoo",
  description: "Listings you saved on this device.",
  path: "/u/account/saved/",
  index: false,
});

export default function Page() {
  return <SavedList />;
}
