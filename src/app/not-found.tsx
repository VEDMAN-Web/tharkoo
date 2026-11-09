import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">That URL is not in the Tharkoo catalogue.</p>
      <Link href="/" className="mt-4 inline-block underline">
        Back home
      </Link>
    </div>
  );
}
