import Link from "next/link";
export const metadata = { title: "Ad removed" };
export default function Gone() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl">This ad was removed</h1>
      <p className="mt-2 text-sm text-[#555]">410 — the listing is gone. Open its city page instead.</p>
      <Link href="/" className="mt-4 inline-block underline">Home</Link>
    </div>
  );
}
