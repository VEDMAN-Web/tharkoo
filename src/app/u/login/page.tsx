import Link from "next/link";

export const metadata = { title: "Log in", robots: { index: false } };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm rounded border bg-white p-6">
      <h1 className="text-xl font-semibold">Log in to Tharkoo</h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">Accounts land in slice 2. This screen is here so the header replica is complete.</p>
      <form className="mt-4 grid gap-3 text-sm">
        <input className="rounded border px-3 py-2" type="email" placeholder="Email" />
        <input className="rounded border px-3 py-2" type="password" placeholder="Password" />
        <button className="rounded bg-[var(--brand-primary)] px-4 py-2 font-semibold text-white">Log in (soon)</button>
      </form>
      <p className="mt-3 text-sm">
        <Link href="/u/post-insert">Post your ad</Link>
      </p>
    </div>
  );
}
