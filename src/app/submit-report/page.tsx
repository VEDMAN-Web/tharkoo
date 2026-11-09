import { StaticPage } from "@/components/StaticPage";
export const metadata = { title: "Submit a report" };
export default async function ReportPage({ searchParams }: { searchParams: Promise<{ ad?: string }> }) {
  const { ad } = await searchParams;
  return (
    <StaticPage title="Report an ad">
      <form className="mt-4 grid max-w-md gap-3 text-sm text-[#333]">
        <label className="grid gap-1">
          Ad ID
          <input name="adId" className="border px-3 py-2" defaultValue={ad} placeholder="inXXXXXXX" />
        </label>
        <label className="grid gap-1">
          Reason
          <select name="reason" className="border px-3 py-2">
            <option>Spam</option>
            <option>Scam / payment fraud</option>
            <option>Stolen photos</option>
            <option>Illegal content</option>
            <option>Other</option>
          </select>
        </label>
        <label className="grid gap-1">
          Details
          <textarea name="details" rows={4} className="border px-3 py-2" />
        </label>
        <button className="btn-post">Send</button>
      </form>
    </StaticPage>
  );
}
