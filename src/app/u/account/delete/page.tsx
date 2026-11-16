import Link from "next/link";
import { Trash2 } from "lucide-react";
import { EmptyIcon } from "@/components/buyer/UserPanelShell";
import { PanelPage } from "@/components/buyer/PanelPage";
import { pageMetadata } from "@/lib/ui/meta";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Delete account | Tharkoo",
  description: "How to delete your Tharkoo account.",
  path: "/u/account/delete/",
  index: false,
});

export default function Page() {
  return (
    <PanelPage active="settings" next="/u/account/delete/" title="Log in to manage your account" body="Account options appear here after you log in.">
      <section aria-labelledby="delete-title" className="up-glass up-panel up-stack" data-tk="delete-account">
        <EmptyIcon icon={Trash2} />
        <h1 id="delete-title" className="up-h2">Delete your account</h1>
        <p className="up-empty-body">Deleting your account is permanent. Our team does it for you, so no one removes an account by mistake.</p>
        <ul className="up-list">
          <li>Your ads are taken down and your profile is removed.</li>
          <li>Credits left in your wallet are lost, so use them first.</li>
          <li>Past payments stay in our records, as the law asks.</li>
        </ul>
        <div className="up-actions">
          <Link href="/u/account/support/new/" className="up-btn" data-tk="delete-ask">Ask support to delete my account</Link>
          <Link href="/u/account/edit-account/" className="up-btn-ghost">Keep my account</Link>
        </div>
      </section>
    </PanelPage>
  );
}
