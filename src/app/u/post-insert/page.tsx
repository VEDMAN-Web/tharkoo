import Link from "next/link";

export const metadata = { title: "Post your ad", robots: { index: false } };

export default function PostInsertPage() {
  return (
    <div className="mx-auto max-w-lg rounded border bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Step 1 of 3</p>
      <h1 className="mt-1 text-2xl font-semibold">Post your ad</h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        The 3-step wizard (information → photos → promote) is slice 2. Layout is in place so the public replica has the
        same CTA as the reference.
      </p>
      <ol className="mt-4 list-decimal pl-5 text-sm leading-6">
        <li>Information (category, city, title, contacts)</li>
        <li>Photos</li>
        <li>Promote (Top / Flash / Star) or publish as Basic</li>
      </ol>
      <Link href="/u/login" className="mt-6 inline-block rounded bg-[var(--brand-accent)] px-4 py-2 text-sm font-semibold text-white hover:text-white">
        Continue to login
      </Link>
    </div>
  );
}
