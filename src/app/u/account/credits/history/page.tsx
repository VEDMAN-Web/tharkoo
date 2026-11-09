import { Simple } from "@/components/vendor/VendorScreens";
export const metadata = { title: "Transaction history", robots: { index: false } };
export default function Page() {
  return (
    <Simple title="Transaction history">
      <table className='w-full text-[13px]'><thead><tr><th>Date</th><th>Type</th><th>Credits</th></tr></thead><tbody><tr><td>9 Nov</td><td>purchase</td><td>+500</td></tr><tr><td>8 Nov</td><td>spend Top</td><td>-80</td></tr></tbody></table><p className='mt-2'>Empty state: no transactions.</p>
    </Simple>
  );
}
