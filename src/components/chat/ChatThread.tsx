"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHAT_AD_NOT_LIVE } from "@/lib/chat-text";
import { api, friendlyError } from "@/lib/ui/api";

export const CHAT_POLL_MS = 5000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

type Message = { id: string; mine: boolean; text: string; imageUrl: string | null; createdAt: string; read: boolean; deleted: boolean };
type Info = { listingTitle: string; blocked: boolean; reported: boolean; role: "buyer" | "seller"; adLive?: boolean };
type Loaded = { conversation: Info; messages: Message[] };
export type CreateResult = { id: string } | { error: string };

const buttonStyle = { minHeight: 32, padding: "4px 12px", fontSize: 13 } as const;

/** One conversation: messages, a text box with photo attach, Report and Block. Polls every 5 s while mounted. */
export function ChatThread({
  conversationId,
  onCreate,
  variant = "page",
  peerName = "",
  hideTitle = false,
}: {
  conversationId: string | null;
  onCreate?: () => Promise<CreateResult>;
  variant?: "page" | "panel";
  peerName?: string;
  hideTitle?: boolean;
}) {
  const [info, setInfo] = useState<Info | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  // H18.16 (Vedant): a picked photo waits here for a look and a Send, it is never sent the moment it is picked.
  const [pending, setPending] = useState<{ file: File; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const last = useRef("");
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (id: string | null = conversationId) => {
    if (!id) return;
    const query = last.current ? `?after=${encodeURIComponent(last.current)}` : "";
    const res = await api<Loaded>(`/api/chat/conversations/${id}/messages${query}`);
    if (!res.ok) return setNote(friendlyError(res.error));
    setInfo(res.data.conversation);
    if (res.data.messages.length === 0) return;
    window.dispatchEvent(new Event("tk:chat-activity"));
    last.current = res.data.messages[res.data.messages.length - 1].createdAt;
    setMessages((current) => {
      const seen = new Set(current.map((message) => message.id));
      return [...current, ...res.data.messages.filter((message) => !seen.has(message.id))];
    });
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    const first = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, CHAT_POLL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [load, conversationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages.length]);

  async function send(photo?: File) {
    const body = text.trim();
    if (!body && !photo) return;
    setBusy(true);
    setNote("");
    let id = conversationId;
    if (!id) {
      const created = onCreate ? await onCreate() : { error: "Chat is unavailable right now." };
      if ("error" in created) {
        setBusy(false);
        return setNote(created.error);
      }
      id = created.id;
    }
    let res;
    if (photo) {
      const form = new FormData();
      form.set("text", body);
      form.set("image", photo);
      const raw = await fetch(`/api/chat/conversations/${id}/messages`, { method: "POST", body: form, credentials: "same-origin" });
      const json = (await raw.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null;
      res = json?.ok ? { ok: true as const } : { ok: false as const, message: json?.error?.message || "Could not send the photo." };
    } else {
      const sent = await api(`/api/chat/conversations/${id}/messages`, { method: "POST", body: JSON.stringify({ text: body }) });
      res = sent.ok ? { ok: true as const } : { ok: false as const, message: friendlyError(sent.error) };
    }
    setBusy(false);
    if (!res.ok) return setNote(res.message);
    setText("");
    await load(id);
  }

  function pick(file: File | undefined) {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) return setNote("Use a JPG, PNG or WebP photo up to 5 MB.");
    setNote("");
    setPending((old) => {
      if (old) URL.revokeObjectURL(old.url);
      return { file, url: URL.createObjectURL(file) };
    });
  }

  function dropPending() {
    setPending((old) => {
      if (old) URL.revokeObjectURL(old.url);
      return null;
    });
  }

  async function sendPending() {
    if (!pending) return;
    const file = pending.file;
    dropPending();
    await send(file);
  }

  async function block() {
    // H18.16 (Vedant): either side can end a chat. It closes the conversation for both; Report stays for rule breaking.
    if (!window.confirm("End this chat? Neither of you will be able to send more messages here.")) return;
    const res = await api(`/api/chat/conversations/${conversationId}/block`, { method: "POST", body: "{}" });
    setNote(res.ok ? "Chat ended. No more messages can be sent." : friendlyError(res.error));
    if (res.ok) await load();
  }

  async function report() {
    const reason = window.prompt("What is wrong with this conversation?");
    if (reason === null) return;
    const res = await api(`/api/chat/conversations/${conversationId}/report`, { method: "POST", body: JSON.stringify({ reason }) });
    setNote(res.ok ? "Reported. Our team can now read this conversation." : friendlyError(res.error));
    if (res.ok) await load();
  }

  const blocked = info?.blocked ?? false;
  // FIX-3: a chat about an ad that is not live (removed, expired, paused) can be read but not written to.
  const adGone = info?.adLive === false;
  const closed = blocked || adGone;
  const panel = variant === "panel";
  const bubbleStyle = (mine: boolean) =>
    panel
      ? undefined
      : {
          justifySelf: mine ? "end" : "start",
          maxWidth: "85%",
          padding: "8px 12px",
          borderRadius: 12,
          // FIX-8 (E1-B9): the own bubble is the same deep pink as the panel bubble, with white text (at least 5:1), not dark text on the accent.
          background: mine ? "linear-gradient(135deg, #d1137a, #a8124f)" : "var(--bg-soft)",
          color: mine ? "#fff" : "var(--text)",
          overflowWrap: "anywhere" as const,
          whiteSpace: "pre-wrap" as const,
        };
  return (
    <div data-tk="chat-thread" className={panel ? "tkn-thread" : undefined} style={panel ? undefined : { display: "grid", gridTemplateRows: "auto 1fr auto", minHeight: 0, height: "100%" }}>
      {panel ? null : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
          {hideTitle ? <span style={{ flex: 1 }} /> : <strong style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{info?.listingTitle || "Chat"}</strong>}
          <button type="button" className="tk-btn tk-btn-outline-primary" style={buttonStyle} onClick={() => void report()} disabled={info?.reported}>
            {info?.reported ? "Reported" : "Report"}
          </button>
          <button type="button" className="tk-btn tk-btn-outline-primary" style={buttonStyle} onClick={() => void block()} disabled={blocked}>
            {blocked ? "Chat ended" : "End chat"}
          </button>
        </div>
      )}
      <div role="log" aria-live="polite" aria-label="Messages" className={panel ? "tkn-thread-log" : undefined} style={panel ? undefined : { overflowY: "auto", padding: 12, display: "grid", gap: 8, alignContent: "start" }}>
        {messages.length === 0 ? (
          <p className="t-small">{panel ? `Say hello to ${peerName}. Your first message starts the chat.` : "No messages yet. Say hello. Phone numbers and emails are never shown here."}</p>
        ) : null}
        {messages.map((message) => (
          <div key={message.id} className={panel ? `tkn-msg${message.mine ? " is-mine" : ""}` : undefined} style={bubbleStyle(message.mine)}>
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
        className={panel ? "tkn-thread-form" : undefined}
        style={panel ? undefined : { display: "grid", gap: 6, padding: 12, borderTop: "1px solid var(--border)" }}
      >
        {note ? <p role="status" className="t-small" data-tk="chat-note">{note}</p> : null}
        {adGone && !blocked ? <p role="status" className="t-small" data-tk="chat-readonly">{CHAT_AD_NOT_LIVE}</p> : null}
        {pending ? (
          <div data-tk="chat-photo-preview" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 0" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pending.url} alt="Photo ready to send" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 10 }} />
            <span className="t-small" style={{ flex: "1 1 120px" }}>Only sent when you press Send photo.</span>
            <button type="button" className={panel ? "tkn-btn tkn-btn-ghost" : "tk-btn tk-btn-outline-primary"} style={panel ? undefined : buttonStyle} onClick={dropPending}>Remove</button>
            <button type="button" className={panel ? "tkn-btn tkn-btn-primary" : "tk-btn tk-btn-cta"} style={panel ? undefined : buttonStyle} disabled={closed || busy} onClick={() => void sendPending()} data-tk="chat-photo-send">Send photo</button>
          </div>
        ) : null}
        <textarea
          className={panel ? "tkn-thread-input" : "tk-input"}
          rows={2}
          maxLength={1000}
          value={text}
          disabled={closed}
          aria-label="Your message"
          placeholder={blocked ? "This chat has ended" : adGone ? "This ad is no longer live" : "Write a message"}
          onChange={(event) => setText(event.target.value)}
          style={panel ? undefined : { fontSize: 16 }}
        />
        <div className={panel ? "tkn-thread-row" : undefined} style={panel ? undefined : { display: "flex", gap: 8 }}>
          <label className={panel ? "tkn-btn tkn-btn-ghost" : "tk-btn tk-btn-outline-primary"} style={panel ? undefined : { ...buttonStyle, cursor: "pointer" }} aria-disabled={closed || busy}>
            Photo
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={closed || busy} onChange={(event) => { pick(event.target.files?.[0]); event.target.value = ""; }} />
          </label>
          {panel && conversationId ? (
            <>
              <button type="button" className="tkn-thread-link" onClick={() => void report()} disabled={info?.reported}>
                {info?.reported ? "Reported" : "Report"}
              </button>
              <button type="button" className="tkn-thread-link" onClick={() => void block()} disabled={blocked}>
                {blocked ? "Chat ended" : "End chat"}
              </button>
            </>
          ) : null}
          <button type="submit" className={panel ? "tkn-btn tkn-btn-primary" : "tk-btn tk-btn-cta"} style={panel ? { marginLeft: "auto" } : { ...buttonStyle, marginLeft: "auto" }} disabled={closed || busy || !text.trim()}>
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
