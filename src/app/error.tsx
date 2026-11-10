"use client";

import { EmptyState } from "@/components/ui/EmptyState";

export default function ErrorView({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="py-10 text-center">
      <EmptyState heading="h1" title="Something went wrong" body="Tharkoo could not load this page. Try again in a moment." action={{ href: "/", label: "Back to home" }} />
      <button type="button" className="tk-btn tk-btn-outline-rose" onClick={reset}>
        Retry
      </button>
    </div>
  );
}
