"use client";

import Link from "next/link";
import { ArrowUp, MessageCircle, Phone, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { safeHref } from "@/lib/sanitize";
import { api, friendlyError, hasSessionHint } from "@/lib/ui/api";
import { loginPath } from "@/lib/urls";
import { useUrlPaths } from "../UrlPaths";
import type { ShellConfig } from "@/server/site-links/shell-config-rules";
import type { SupportTopic } from "@/server/support/constants";

type Chat = ShellConfig["chat"];
type Line = { id: number; from: "you" | "support"; text: string };
type Session = "unknown" | "guest" | "member";

const BODY_MIN = 10;
const SUBJECT_MAX = 60;
const BACK_TO_TOP_AFTER = 300;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s-]{8,20}$/;

function callLink(value: string) {
  const digits = value.replace(/^tel:/i, "").replace(/[^+\d]/g, "");
  return digits.replace(/\D/g, "").length >= 8 ? `tel:${digits}` : "";
}

/** H7.1: the live chat bubble, bottom right, closed by default. Each chat opens or continues an H6.21 support ticket. */
export function SupportChat({ chat }: { chat: Chat }) {
  const paths = useUrlPaths();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<Session>("unknown");
  const [topic, setTopic] = useState<SupportTopic>("something_else");
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showTop, setShowTop] = useState(false);
  const [guest, setGuest] = useState({ name: "", contact: "" });
  const [guestError, setGuestError] = useState("");
  const [guestDone, setGuestDone] = useState(false);
  const nextLine = useRef(0);
  const bubble = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > BACK_TO_TOP_AFTER);
    const id = window.setTimeout(() => {
      setSession(hasSessionHint() ? "member" : "guest");
      onScroll();
    }, 0);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      bubble.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // A signed-in visitor continues their newest open ticket, so the next message lands in the same Support desk thread.
  useEffect(() => {
    if (!open || session !== "member" || ticketId) return;
    let cancelled = false;
    api<{ id: string; status: string }[]>("/api/support/tickets").then((res) => {
      if (cancelled || !res.ok) return;
      const current = res.data.find((item) => item.status !== "closed");
      if (current) setTicketId(current.id);
    });
    return () => {
      cancelled = true;
    };
  }, [open, session, ticketId]);

  function add(from: Line["from"], text: string) {
    nextLine.current += 1;
    setLines((rows) => [...rows, { id: nextLine.current, from, text }]);
  }

  function submitGuest(event: React.FormEvent) {
    event.preventDefault();
    const name = guest.name.trim();
    const contact = guest.contact.trim();
    if (name.length < 2) return setGuestError("Add your name.");
    if (!EMAIL.test(contact) && !PHONE.test(contact)) return setGuestError("Add an email address or a phone number.");
    setGuestError("");
    setGuestDone(true);
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (text.length < BODY_MIN) return setError(`Write at least ${BODY_MIN} characters.`);
    setBusy(true);
    setError("");
    const res = ticketId
      ? await api<unknown>(`/api/support/tickets/${ticketId}/messages`, { method: "POST", body: JSON.stringify({ body: text }) })
      : await api<{ id: string }>("/api/support/tickets", {
          method: "POST",
          body: JSON.stringify({ topic, subject: text.slice(0, SUBJECT_MAX), body: text }),
        });
    setBusy(false);
    if (!res.ok) return setError(friendlyError(res.error));
    if (!ticketId && res.data && typeof res.data === "object" && "id" in res.data) setTicketId(String(res.data.id));
    add("you", text);
    add("support", "Thanks. Support answers in this chat and in your support tickets.");
    setDraft("");
  }

  const whatsapp = safeHref(chat.whatsapp);
  const telegram = safeHref(chat.telegram);
  const call = callLink(chat.phone);
  const quick = [
    whatsapp ? { label: "WhatsApp", href: whatsapp, icon: "wa" } : null,
    telegram ? { label: "Telegram", href: telegram, icon: "tg" } : null,
    call ? { label: "Call", href: call, icon: "call" } : null,
  ].filter((item): item is { label: string; href: string; icon: string } => item !== null);
  const canWrite = session === "member";
  const showGuest = session === "guest" && !guestDone;

  return (
    <div className="tkn-float">
      {open ? (
        <section aria-label={chat.title} className="tkn-chatbox" id="tkn-chat-panel">
          <div className="tkn-chat-head">
            <span className="tkn-mark" aria-hidden="true">t</span>
            <div className="tkn-chat-title">
              <strong>{chat.title}</strong>
              <span className="tkn-chat-status"><span className="tkn-dot" aria-hidden="true" />{chat.status}</span>
            </div>
            <button type="button" className="tkn-icon-btn" aria-label="Close chat" onClick={() => setOpen(false)}>
              <X size={18} aria-hidden="true" focusable="false" />
            </button>
          </div>
          {quick.length ? (
            <div className="tkn-chat-quick">
              {quick.map((item) => (
                <a key={item.label} href={item.href} className="tkn-btn tkn-btn-ghost tkn-btn-sm" target={item.icon === "call" ? undefined : "_blank"} rel="noopener noreferrer">
                  {item.icon === "call" ? <Phone size={14} aria-hidden="true" focusable="false" /> : item.icon === "tg" ? <Send size={14} aria-hidden="true" focusable="false" /> : <MessageCircle size={14} aria-hidden="true" focusable="false" />}
                  {item.label}
                </a>
              ))}
            </div>
          ) : null}
          <div className="tkn-chat-body" aria-live="polite">
            <p className="tkn-bubble tkn-bubble-in">{chat.welcome}</p>
            <div className="tkn-topics" role="group" aria-label="What do you need help with?">
              {chat.topics.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="tkn-chip"
                  aria-pressed={topic === item.topic}
                  onClick={() => setTopic(item.topic)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {showGuest ? (
              <form className="tkn-guest" onSubmit={submitGuest} noValidate>
                <p className="t-small">{chat.guestHint}</p>
                <label className="tkn-field">
                  <span>Your name</span>
                  <input value={guest.name} autoComplete="name" maxLength={80} onChange={(e) => setGuest({ ...guest, name: e.target.value })} />
                </label>
                <label className="tkn-field">
                  <span>Email or phone</span>
                  <input value={guest.contact} autoComplete="email" maxLength={120} onChange={(e) => setGuest({ ...guest, contact: e.target.value })} />
                </label>
                {guestError ? <p className="tkn-error" role="alert">{guestError}</p> : null}
                <button type="submit" className="tkn-btn tkn-btn-primary tkn-btn-block">Continue</button>
              </form>
            ) : null}
            {lines.map((line) => (
              <p key={line.id} className={line.from === "you" ? "tkn-bubble tkn-bubble-you" : "tkn-bubble tkn-bubble-in"}>{line.text}</p>
            ))}
            {error ? <p className="tkn-error" role="alert">{error}</p> : null}
            {session === "guest" && guestDone ? (
              <div className="tkn-guest">
                <p className="t-small">Log in to send your message. Support then answers in your account.</p>
                <Link href={loginPath(paths)} className="tkn-btn tkn-btn-primary tkn-btn-block">Log in to chat</Link>
              </div>
            ) : null}
          </div>
          {canWrite ? (
            <form className="tkn-composer" onSubmit={send}>
              <label className="tkn-sr" htmlFor="tkn-chat-input">Message</label>
              <input id="tkn-chat-input" value={draft} placeholder="Type a message" maxLength={4000} onChange={(e) => setDraft(e.target.value)} />
              <button type="submit" className="tkn-send" aria-label="Send" disabled={busy}>
                <Send size={18} aria-hidden="true" focusable="false" />
              </button>
            </form>
          ) : null}
        </section>
      ) : null}
      {showTop ? (
        <button type="button" className="tkn-top" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <ArrowUp size={18} aria-hidden="true" focusable="false" />
        </button>
      ) : null}
      <button
        ref={bubble}
        type="button"
        className="tkn-chat-bubble"
        aria-expanded={open}
        aria-controls={open ? "tkn-chat-panel" : undefined}
        aria-label={open ? "Close live chat" : "Open live chat"}
        onClick={() => setOpen((value) => !value)}
      >
        <MessageCircle size={26} aria-hidden="true" focusable="false" />
      </button>
    </div>
  );
}
