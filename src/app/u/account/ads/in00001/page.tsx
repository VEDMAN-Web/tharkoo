import Link from "next/link";
import { VendorShell } from "@/components/vendor/VendorShell";
export const metadata = { title: "Manage ad", robots: { index: false } };
export default function Page() {
  return (
    <VendorShell title="Ad management">
      <img src="/placeholders/p1.svg" alt="" className="h-40 w-32 object-cover" />
      <p className="mt-2 text-[13px]">Status live · expiry 12 Nov · Top 3 days · auto-renew on</p>
      <p className="text-[13px]">Views 120 · Calls 8 · WhatsApp 11 · Saves 4</p>
      <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
        <Link href="/u/account/ads/in00001/edit/">Edit</Link>
        <Link href="/u/post-insert/">Promote</Link>
        <button type="button">Suspend</button>
      </div>
    </VendorShell>
  );
}
