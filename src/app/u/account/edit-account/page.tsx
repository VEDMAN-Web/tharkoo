import { AccountSettings } from "@/components/account/AccountTools";
import { PhoneLinkCard } from "@/components/PhoneLinkCard";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Settings | Tharkoo",
  description: "Your Tharkoo name, email, and identity status.",
  path: "/u/account/edit-account/",
  index: false,
});

export default function Page() {
  return (
    <>
      <AccountSettings />
      <PhoneLinkCard />
    </>
  );
}
