"use client";

import dynamic from "next/dynamic";

// The chat panel sits below the fold and needs JavaScript to be useful, so its code loads after the page is interactive.
const ChatNow = dynamic(() => import("@/components/chat/ChatNow").then((mod) => mod.ChatNow), {
  ssr: false,
  loading: () => <div style={{ minHeight: 56 }} aria-hidden />,
});

export function LazyChat({ listingId }: { listingId?: string }) {
  return <ChatNow listingId={listingId} />;
}
