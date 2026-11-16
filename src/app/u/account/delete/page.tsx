import { DeleteFlow } from "@/components/buyer/DeleteFlow";
import { PanelPage } from "@/components/buyer/PanelPage";
import { pageMetadata } from "@/lib/ui/meta";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Delete account | Tharkoo",
  description: "Ask our team to delete your Tharkoo account.",
  path: "/u/account/delete/",
  index: false,
});

export default function Page() {
  return (
    <PanelPage active="settings" next="/u/account/delete/" title="Log in to manage your account" body="Account options appear here after you log in.">
      <DeleteFlow />
    </PanelPage>
  );
}
