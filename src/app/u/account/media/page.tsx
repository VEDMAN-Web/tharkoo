import { Simple } from "@/components/vendor/VendorScreens";
export const metadata = { title: "Media — albums", robots: { index: false } };
export default function Page() {
  return (
    <Simple title="Media — albums">
      <p>Albums grid. Create album. Storage limits.</p><div className='mt-3 grid grid-cols-3 gap-2'><a href='/u/account/media/album/'><img src='/placeholders/p1.jpg' alt='' /><span>Safe · 4</span></a></div>
    </Simple>
  );
}
