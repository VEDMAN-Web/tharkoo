import { Simple } from "@/components/vendor/VendorScreens";
export const metadata = { title: "Delete account", robots: { index: false } };
export default function Page() {
  return (
    <Simple title="Delete account">
      <p>Type DELETE to confirm. You will be logged out.</p><input placeholder='DELETE' className='border px-2 py-1' /><button className='btn-post mt-2' type='button'>Delete forever</button>
    </Simple>
  );
}
