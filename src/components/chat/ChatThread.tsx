"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, friendlyError } from "@/lib/ui/api";

export const CHAT_POLL_MS = 5000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

type Message = { id: string; mine: boolean; text: string; imageUrl: string | null; createdAt: string; read: boolean; deleted: boolean };
type Info = { listingTitle: string; blocked: boolean; reported: boolean; role: "buyer" | "seller" };
type Loaded = { conversation: Info; messages: Message[] };

const buttonStyle = { minHeight: 32, padding: "4px 12px", fontSize: 13 } as const;

/** One conversation: messages, a text box with photo attach, Report and Block. Polls every 5 s while mounted. */
export function ChatThread({ conversationId }: { conversationId: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const last = useRef("");
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const query = last.current ? `?after=${encodeURIComponent(last.current)}` : "";
    const res = await api<Loaded>(`/api/chat/conversations/${conversationId}/messages${query}`);
    if (!res.ok) return setNote(friendlyError(res.error));
    setInfo(res.data.conversation);
    if (res.data.messages.length === 0) return;
    last.current = res.data.messages[res.data.messages.length - 1].createdAt;
    setMessages((current) => {
      const seen = new Set(current.map((message) => message.id));
      return [...current, ...res.data.messages.filter((message) => !seen.has(message.id))];
    });
  }, [conversationId]);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, CHAT_POLL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages.length]);

  async function send(photo?: File) {
    const body = text.trim();
    if (!body && !photo) return;
    setBusy(true);
    setNote("");
    let res;
    if (photo) {
      const form = new FormData();
      form.set("text", body);
      form.set("image", photo);
      const raw = await fetch(`/api/chat/conversations/${conversationId}/messages`, { method: "POST", body: form, credentials: "same-origin" });
      const json = (await raw.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null;
      res = json?.ok ? { ok: true as const } : { ok: false as const, message: json?.error?.message || "Could not send the photo." };
    } else {
      const sent = await api(`/api/chat/conversations/${conversationId}/messages`, { method: "POST", body: JSON.stringify({ text: body }) });
      res = sent.ok ? { ok: true as const } : { ok: false as const, message: friendlyError(sent.error) };
    }
    setBusy(false);
    if (!res.ok) return setNote(res.message);
    setText("");
    await load();
  }

  function pick(file: File | undefined) {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) return setNote("Use a JPG, PNG or WebP photo up to 5 MB.");
    void send(file);
  }

  async function block() {
    if (!window.confirm("Block this person? Neither of you will be able to send messages here.")) return;
    const res = await api(`/api/chat/conversations/${conversationId}/block`, { method: "POST", body: "{}" });
    setNote(res.ok ? "Blocked. No more messages can be sent." : friendlyError(res.error));
    if (res.ok) await load();
  }

  async function report() {
    const reason = window.prompt("What is wrong with this conversation?");
    if (reason === null) return;
    const res = await api(`/api/chat/conversations/${conversationId}/report`, { method: "POST", body: JSON.stringify({ reason }) });
    setNote(res.ok ? "Reported. Our team can now read this conversation." : friendlyError(res.error));
    if (res.ok) await load();
  }

  const closed = info?.blocked ?? false;
  return (
    <div data-tk="chat-thread" style={{ display: "grid", gridTemplateRows: "auto 1fr auto", minHeight: 0, height: "100%" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
        <strong style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{info?.listingTitle || "Chat"}</strong>
        <button type="button" className="tk-btn tk-btn-outline-gold" style={buttonStyle} onClick={() => void report()} disabled={info?.reported}>
          {info?.reported ? "Reported" : "Report"}
        </button>
        <button type="button" className="tk-btn tk-btn-outline-gold" style={buttonStyle} onClick={() => void block()} disabled={closed}>
          {closed ? "Blocked" : "Block"}
        </button>
      </div>
      <div role="log" aria-live="polite" aria-label="Messages" style={{ overflowY: "auto", padding: 12, display: "grid", gap: 8, alignContent: "start" }}>
        {messages.length === 0 ? <p className="t-small">No messages yet. Say hello. Phone numbers and emails are never shown here.</p> : null}
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              justifySelf: message.mine ? "end" : "start",
              maxWidth: "85%",
              padding: "8px 12px",
              borderRadius: 12,
              background: message.mine ? "var(--accent)" : "var(--bg-soft)",
              color: message.mine ? "#1a1405" : "var(--text)",
              overflowWrap: "anywhere",
              whiteSpace: "pre-wrap",
            }}
          >
            {message.deleted ? <em>Message removed</em> : null}
            {message.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={message.imageUrl} alt="Photo sent in chat" style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 8, display: "block", marginBottom: message.text ? 6 : 0 }} />
            ) : null}
            {message.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
        style={{ display: "grid", gap: 6, padding: 12, borderTop: "1px solid var(--border)" }}
      >
        {note ? <p role="status" className="t-small" data-tk="chat-note">{note}</p> : null}
        <textarea
          className="tk-input"
          rows={2}
          maxLength={1000}
          value={text}
          disabled={closed}
          aria-label="Your message"
          placeholder={closed ? "This conversation is blocked" : "Write a message"}
          onChange={(event) => setText(event.target.value)}
          style={{ fontSize: 16 }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <label className="tk-btn tk-btn-outline-gold" style={{ ...buttonStyle, cursor: "pointer" }} aria-disabled={closed || busy}>
            Photo
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={closed || busy} onChange={(event) => { pick(event.target.files?.[0]); event.target.value = ""; }} />
          </label>
          <button type="submit" className="tk-btn tk-btn-gold" style={{ ...buttonStyle, marginLeft: "auto" }} disabled={closed || busy || !text.trim()}>
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
