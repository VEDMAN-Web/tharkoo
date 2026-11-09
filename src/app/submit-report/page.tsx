import { StaticPage } from "@/components/StaticPage";

export const metadata = { title: "Submit a report" };

export default function ReportPage() {
  return (
    <StaticPage title="Report an ad">
      <p>This form is a slice-1 shell. Slice 4 stores reports in Mongo for moderators.</p>
      <form className="mt-4 grid max-w-md gap-3 text-sm text-[var(--text-primary)]">
        <label className="grid gap-1">
          Ad ID
          <input name="adId" className="rounded border px-3 py-2" placeholder="inXXXXXXX" />
        </label>
        <label className="grid gap-1">
          Reason
          <select name="reason" className="rounded border px-3 py-2">
            <option>Spam</option>
            <option>Scam / payment fraud</option>
            <option>Stolen photos</option>
            <option>Illegal content</option>
            <option>Other</option>
          </select>
        </label>
        <label className="grid gap-1">
          Details
          <textarea name="details" rows={4} className="rounded border px-3 py-2" />
        </label>
        <button className="rounded bg-[var(--brand-primary)] px-4 py-2 font-semibold text-white">Send (demo)</button>
      </form>
    </StaticPage>
  );
}
