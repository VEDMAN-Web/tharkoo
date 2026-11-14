"use client";

import { useEffect } from "react";
import { ChatThread } from "./ChatThread";

/** The chat panel opened from the ad's contact card. Escape or Close hides it. */
export function ChatPanel({ conversationId, onClose }: { conversationId: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
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
        <button type="button" className="tk-btn tk-btn-outline-gold" style={{ minHeight: 32, padding: "2px 12px" }} onClick={onClose} aria-label="Close chat">
          Close
        </button>
      </div>
      <div style={{ minHeight: 0 }}>
        <ChatThread conversationId={conversationId} />
      </div>
    </div>
  );
}
