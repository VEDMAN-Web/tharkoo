import { Simple } from "@/components/vendor/VendorScreens";
export const metadata = { title: "Bank transfer", robots: { index: false } };
export default function Page() {
  return (
    <Simple title="Bank transfer">
      <p>Bank details, amount, upload proof, name, email, ID. Status: pending 24–48 h.</p><input type='file' className='mt-2' /><button className='btn-post mt-3' type='button'>Send proof</button>
    </Simple>
  );
}
