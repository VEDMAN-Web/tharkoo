import { CreditsHistory } from "@/components/buyer/CreditsHistory";
import { PanelPage } from "@/components/buyer/PanelPage";
import { pageMetadata } from "@/lib/ui/meta";

export const metadata = pageMetadata({
  title: "Credits history | Tharkoo",
  description: "Your credit purchases and the credits you used.",
  path: "/u/account/credits/history/",
  index: false,
});

export default function Page() {
  return (
    <PanelPage active="coins" next="/u/account/credits/history/" title="Log in to see your credits history" body="Your purchases and receipts are kept on your account.">
      <CreditsHistory />
    </PanelPage>
  );
}
