"use client";

export default function ErrorView({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">Tharkoo could not load</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-secondary)]">
        {error.message}. If this is a fresh clone, run <code>npm run dev</code> so Mongo is seeded, or set{" "}
        <code>MONGODB_URI</code>.
      </p>
      <button className="mt-4 underline" onClick={reset}>
        Retry
      </button>
    </div>
  );
}
