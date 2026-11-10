import Link from "next/link";
import { Simple } from "@/components/vendor/VendorScreens";
export const metadata = { title: "KYC", robots: { index: false } };
export default function Page() {
  return (
    <Simple title="KYC">
      <ol className='list-decimal pl-5 text-[14px]'><li>Intro and tips</li><li>Desktop: QR + continue on phone</li><li>Document front/back</li><li>Face scan</li><li>Final check</li><li>Verified or Failed</li></ol><Link className='btn-post mt-4 inline-block' href='/u/account/dashboard/'>Done</Link>
    </Simple>
  );
}
