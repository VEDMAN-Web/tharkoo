import { Simple } from "@/components/vendor/VendorScreens";
export const metadata = { title: "Settings", robots: { index: false } };
export default function Page() {
  return (
    <Simple title="Settings">
      <form className='grid max-w-md gap-2'><label className='field'>Email<input defaultValue='vendor@tharkoo.demo' /></label><label className='field'>Phone<input /></label><label className='field'>Password<input type='password' /></label><label className='flex gap-2 text-[13px]'><input type='checkbox' defaultChecked /> Newsletter</label><button className='btn-post' type='button'>Save</button><a href='/u/account/delete/'>Delete account</a></form>
    </Simple>
  );
}
