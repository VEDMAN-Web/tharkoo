import Link from "next/link";
import { VendorShell } from "@/components/vendor/VendorShell";
import { getCreditPacks, getSite } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Wallet", robots: { index: false } };

export default async function Wallet() {
  const [packs, site] = await Promise.all([getCreditPacks(), getSite()]);
  return (
    <VendorShell title="Wallet — Buy credits">
      <p className="mb-3 text-[13px]">Available 1,200 · Used 340 · <Link href="/u/account/credits/history/">Transaction history</Link></p>
      <form className="mb-4 flex gap-2 text-[13px]">
        <input className="border px-2 py-1" placeholder="Coupon" />
        <button className="btn-ghost" type="button">Apply</button>
      </form>
      <div className="grid gap-2 sm:grid-cols-2">
        {packs.map((p) => (
          <label key={String(p._id)} className="flex items-start gap-2 bg-white p-3 text-[13px]">
            <input type="radio" name="pack" defaultChecked={p.tag === "Most popular"} />
            <span>
              <strong>{p.credits} credits</strong> · ₹{p.price} {p.bonus ? `+${p.bonus} bonus` : ""} {p.tag ? `· ${p.tag}` : ""}
            </span>
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn-post" type="button">Pay</button>
        <Link href="/u/account/credits/bank/" className="btn-ghost">Bank transfer</Link>
      </div>
      <p className="mt-4 text-[12px] text-[#777]">
        Support {site.supportHours} · WhatsApp {(site as { supportWhatsapp?: string }).supportWhatsapp} · Telegram {(site as { supportTelegram?: string }).supportTelegram}
      </p>
    </VendorShell>
  );
}
