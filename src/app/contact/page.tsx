import { getSite } from "@/lib/queries";
export const dynamic = "force-dynamic";
export const metadata = { title: "Contact us" };
export default async function Contact() {
  const site = await getSite();
  return (
    <div className="panel max-w-lg">
      <h1 className="text-[22px]">Contact us</h1>
      <p className="mt-2 text-[13px]">Hours {site.supportHours}</p>
      <form className="mt-4 grid gap-2">
        <input className="border px-3 py-2" placeholder="Category" />
        <input className="border px-3 py-2" placeholder="Subject" />
        <textarea className="border px-3 py-2" rows={4} placeholder="Message" />
        <input className="border px-3 py-2" placeholder="Customer Code" />
        <button className="btn-post">Send</button>
      </form>
    </div>
  );
}
