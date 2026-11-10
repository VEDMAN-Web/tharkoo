import Link from "next/link";
import { Simple } from "@/components/vendor/VendorScreens";
export const metadata = { title: "Album detail", robots: { index: false } };
export default function Page() {
  return (
    <Simple title="Album detail">
      <p>Grid with Safe/Restricted/Rejected. Upload, verify photos, add videos.</p><Link href='/u/account/media/verify/'>Verify photos</Link>
    </Simple>
  );
}
