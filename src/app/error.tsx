"use client";

export default function ErrorView({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">Tharkoo could not load</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-secondary)]">
        Something went wrong. Try again in a moment.
      </p>
      <button className="mt-4 underline" onClick={reset}>
        Retry
      </button>
    </div>
  );
}
