"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { api, friendlyError } from "@/lib/ui/api";
import { ChatThread } from "./ChatThread";

/** The "Chat now" contact button. Signed-out visitors are asked to sign in first; signed-in users get the chat panel. */
export function ChatNow({ listingId }: { listingId?: string }) {
  const [conversationId, setConversationId] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [needsSignIn, setNeedsSignIn] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function start() {
    if (!listingId) return setNote("Chat is unavailable right now.");
    if (conversationId) return setOpen(true);
    setBusy(true);
    setNote("");
    const res = await api<{ conversationId: string }>("/api/chat/conversations", { method: "POST", body: JSON.stringify({ listingId }) });
    setBusy(false);
    if (res.ok) {
      setConversationId(res.data.conversationId);
      return setOpen(true);
    }
    if (res.status === 401) return setNeedsSignIn(true);
    setNote(friendlyError(res.error));
  }

  const next = typeof window === "undefined" ? "/" : encodeURIComponent(window.location.pathname);
  return (
    <div data-tk="chat-now" style={{ display: "grid", gap: 8, justifyItems: "stretch" }}>
      <button type="button" className="tk-btn tk-btn-outline-gold" data-tk="chat" onClick={() => void start()} disabled={busy}>
        <MessageCircle size={16} aria-hidden /> {busy ? "..." : "Chat now"}
      </button>
      {needsSignIn ? (
        <p role="status" className="t-small">
          Sign in to chat with the advertiser.{" "}
          <a href={`/u/login/?next=${next}`} style={{ color: "var(--accent)", textDecoration: "underline" }}>
            Sign in
          </a>
        </p>
      ) : null}
      {note ? <p role="status" className="t-small">{note}</p> : null}
      {open && conversationId ? (
        <div
          role="dialog"
          aria-label="Chat with the advertiser"
          data-tk="chat-panel"
          style={{
            position: "fixed",
            zIndex: 60,
            left: 0,
            right: 0,
            bottom: 0,
            height: "min(80vh, 560px)",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "16px 16px 0 0",
            boxShadow: "0 -8px 32px rgba(0,0,0,0.25)",
            display: "grid",
            gridTemplateRows: "auto 1fr",
            maxWidth: 480,
            marginInline: "auto",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px" }}>
            <span className="t-small" style={{ fontWeight: 700 }}>Chat</span>
            <button type="button" className="tk-btn tk-btn-outline-gold" style={{ minHeight: 32, padding: "2px 12px" }} onClick={() => setOpen(false)} aria-label="Close chat">
              Close
            </button>
          </div>
          <div style={{ minHeight: 0 }}>
            <ChatThread conversationId={conversationId} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
