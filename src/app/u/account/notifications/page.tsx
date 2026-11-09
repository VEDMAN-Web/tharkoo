import { Simple } from "@/components/vendor/VendorScreens";
export const metadata = { title: "Notifications", robots: { index: false } };
export default function Page() {
  return (
    <Simple title="Notifications">
      <ul className='text-[13px]'><li>Ad approved</li><li>KYC verified</li><li>Low credits</li></ul><p>Empty: no notifications.</p>
    </Simple>
  );
}
