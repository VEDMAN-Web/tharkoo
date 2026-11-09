import { Simple } from "@/components/vendor/VendorScreens";
export const metadata = { title: "Viewer age verification", robots: { index: false } };
export default function Page() {
  return (
    <Simple title="Viewer age verification">
      <p>Start verification to open restricted photos. This demo keeps clothed placeholders.</p><button className='btn-post' type='button'>Start verification</button>
    </Simple>
  );
}
