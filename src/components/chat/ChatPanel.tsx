"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { api, friendlyError } from "@/lib/ui/api";
import { ChatThread, type CreateResult } from "./ChatThread";

type InboxRow = { id: string; listingId: string };

export function ChatPanel({
  listingId,
  peerName,
  conversationId,
  onConversation,
  onClose,
}: {
  listingId: string;
  peerName: string;
  conversationId: string;
  onConversation: (id: string) => void;
  onClose: () => void;
}) {
  const [looked, setLooked] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const loading = !conversationId && !looked;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // H7.131: a tap or click outside the chat closes it, like Escape and the X. The Chat buttons are not "outside".
  useEffect(() => {
    const onPointer = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element) || panel.current?.contains(target)) return;
      if (target.closest("[data-tk=chat], [data-tk=pop-chat]")) return;
      onClose();
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [onClose]);

  useEffect(() => {
    if (conversationId) return;
    let live = true;
    void api<InboxRow[]>("/api/chat/conversations").then((res) => {
      if (!live) return;
      const found = res.ok ? res.data.find((row) => row.listingId === listingId) : undefined;
      if (found) onConversation(found.id);
      setLooked(true);
    });
    return () => {
      live = false;
    };
  }, [conversationId, listingId, onConversation]);

  const create = useCallback(async (): Promise<CreateResult> => {
    const res = await api<{ conversationId: string }>("/api/chat/conversations", { method: "POST", body: JSON.stringify({ listingId }) });
    if (!res.ok) return { error: res.status === 401 ? "Log in to send a message." : friendlyError(res.error) };
    onConversation(res.data.conversationId);
    return { id: res.data.conversationId };
  }, [listingId, onConversation]);

  return (
    <section ref={panel} role="dialog" aria-label={`Chat with ${peerName}`} data-tk="chat-panel" className="tkn-chatp">
      <header className="tkn-chatp-head">
        <span className="tkn-chatp-avatar" aria-hidden="true">{peerName.slice(0, 1).toUpperCase()}</span>
        <span className="tkn-chatp-who">
          <strong data-tk="chat-peer">{peerName}</strong>
          <span>Phone numbers and emails are never shown here.</span>
        </span>
        <button type="button" className="tkn-icon-btn" aria-label="Close chat" onClick={onClose}>
          <X size={18} aria-hidden="true" focusable="false" />
        </button>
      </header>
      {loading ? (
        <div className="tkn-chatp-skel" data-tk="chat-skeleton" role="status" aria-busy="true" aria-label="Loading chat">
          <span className="tkn-skel" style={{ width: "62%", height: 38 }} />
          <span className="tkn-skel" style={{ width: "48%", height: 38, justifySelf: "end" }} />
          <span className="tkn-skel" style={{ width: "70%", height: 38 }} />
          <span className="tkn-skel" style={{ width: "100%", height: 64, marginTop: "auto" }} />
        </div>
      ) : (
        <div className="tkn-chatp-body">
          <ChatThread conversationId={conversationId || null} onCreate={create} variant="panel" peerName={peerName} />
        </div>
      )}
    </section>
  );
}
