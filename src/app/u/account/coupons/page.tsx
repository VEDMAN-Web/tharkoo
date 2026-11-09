import { Simple } from "@/components/vendor/VendorScreens";
export const metadata = { title: "Coupons", robots: { index: false } };
export default function Page() {
  return (
    <Simple title="Coupons">
      <p>Tabs Active / Used / Expired. WELCOME50 — 50 extra credits — Use now.</p><a href='/u/account/credits/'>Use now</a>
    </Simple>
  );
}
