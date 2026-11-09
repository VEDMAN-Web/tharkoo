import { Simple } from "@/components/vendor/VendorScreens";
export const metadata = { title: "Subscription", robots: { index: false } };
export default function Page() {
  return (
    <Simple title="Subscription">
      <p>Benefits, launch price, FAQ, Subscribe. Manage: period, Renew/Extend, Cancel with last confirmation.</p><button className='btn-post' type='button'>Subscribe</button>
    </Simple>
  );
}
