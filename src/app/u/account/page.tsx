import Link from "next/link";

export const metadata = { title: "Account", robots: { index: false } };

export default function BuyerHome() {
  return (
    <div>
      <h1 className="text-[22px]">Account home</h1>
      <p className="text-[13px]">Customer Code <strong>IN46SXA6</strong></p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Link href="/u/account/saved/" className="bg-white p-4 text-[#333] no-underline">Saved contacts</Link>
        <Link href="/u/account/edit-account/" className="bg-white p-4 text-[#333] no-underline">Settings</Link>
        <Link href="/u/account/kyc/" className="bg-white p-4 text-[#333] no-underline">Become a vendor</Link>
      </div>
    </div>
  );
}
