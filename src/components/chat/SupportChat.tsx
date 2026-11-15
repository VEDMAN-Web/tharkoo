"use client";

import { ArrowUp, MessageCircle, Phone, Send, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { safeHref } from "@/lib/sanitize";
import { useDismiss } from "@/components/ui/useDismiss";
import { api, friendlyError, hasSessionHint } from "@/lib/ui/api";
import { makeT, type UiTextMap } from "@/lib/ui/text";
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
export function SupportChat({ chat, texts }: { chat: Chat; texts?: UiTextMap }) {
  // H7.8: every visible word in the chat comes from the UI-text store (defaults in src/lib/ui/text.ts).
  const t = useMemo(() => makeT(texts), [texts]);
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
  const [guestSent, setGuestSent] = useState(false);
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

  // H7.4c: a click or tap outside the chat (panel and bubble) closes it, as does Escape.
  const float = useRef<HTMLDivElement>(null);
  useDismiss(open, float, () => setOpen(false));

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
    if (name.length < 2) return setGuestError(t("chat.guest.needName"));
    if (!EMAIL.test(contact) && !PHONE.test(contact)) return setGuestError(t("chat.guest.needContact"));
    setGuestError("");
    setGuestDone(true);
  }

  /** H7.1: a guest opens one ticket with the name and contact given. Replies come by email link when an address was given. */
  async function sendAsGuest(text: string) {
    setBusy(true);
    setError("");
    const contact = guest.contact.trim();
    const byEmail = EMAIL.test(contact);
    const res = await api<{ replyVia: "email" | "phone"; emailed: boolean }>("/api/support/guest/tickets", {
      method: "POST",
      body: JSON.stringify({ name: guest.name.trim(), email: byEmail ? contact : "", phone: byEmail ? "" : contact, topic, body: text }),
    });
    setBusy(false);
    if (!res.ok) return setError(friendlyError(res.error));
    setGuestSent(true);
    add("you", text);
    add(
      "support",
      res.data.replyVia === "email" ? t("chat.guest.replyEmail") : t("chat.guest.replyPhone"),
    );
    setDraft("");
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (text.length < BODY_MIN) return setError(t("chat.composer.minLength", { count: BODY_MIN }));
    if (session === "guest") return sendAsGuest(text);
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
    add("support", t("chat.reply.first"));
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
  // Members write at once. A guest writes after the name and contact step, and once: the first message opens the ticket.
  const canWrite = session === "member" || (session === "guest" && guestDone && !guestSent);
  const showGuest = session === "guest" && !guestDone;

  return (
    <div className="tkn-float" ref={float}>
      {open ? (
        <section aria-label={chat.title} className="tkn-chatbox" id="tkn-chat-panel">
          <div className="tkn-chat-head">
            <span className="tkn-mark" aria-hidden="true">t</span>
            <div className="tkn-chat-title">
              <strong>{chat.title}</strong>
              <span className="tkn-chat-status"><span className="tkn-dot" aria-hidden="true" />{chat.status}</span>
            </div>
            <button type="button" className="tkn-icon-btn" aria-label={t("chat.closePanel")} onClick={() => setOpen(false)}>
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
            <div className="tkn-topics" role="group" aria-label={t("chat.topicsLabel")}>
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
                  <span>{t("chat.guest.name")}</span>
                  <input value={guest.name} autoComplete="name" maxLength={80} onChange={(e) => setGuest({ ...guest, name: e.target.value })} />
                </label>
                <label className="tkn-field">
                  <span>{t("chat.guest.contact")}</span>
                  <input value={guest.contact} autoComplete="email" maxLength={120} onChange={(e) => setGuest({ ...guest, contact: e.target.value })} />
                </label>
                {guestError ? <p className="tkn-error" role="alert">{guestError}</p> : null}
                <button type="submit" className="tkn-btn tkn-btn-primary tkn-btn-block">{t("chat.guest.continue")}</button>
              </form>
            ) : null}
            {lines.map((line) => (
              <p key={line.id} className={line.from === "you" ? "tkn-bubble tkn-bubble-you" : "tkn-bubble tkn-bubble-in"}>{line.text}</p>
            ))}
            {error ? <p className="tkn-error" role="alert">{error}</p> : null}
          </div>
          {canWrite ? (
            <form className="tkn-composer" onSubmit={send}>
              <label className="tkn-sr" htmlFor="tkn-chat-input">{t("chat.composer.label")}</label>
              <input id="tkn-chat-input" value={draft} placeholder={t("chat.composer.placeholder")} maxLength={4000} onChange={(e) => setDraft(e.target.value)} />
              <button type="submit" className="tkn-send" aria-label={t("chat.composer.send")} disabled={busy}>
                <Send size={18} aria-hidden="true" focusable="false" />
              </button>
            </form>
          ) : null}
        </section>
      ) : null}
      {showTop ? (
        <button type="button" className="tkn-top" aria-label={t("chat.backToTop")} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <ArrowUp size={18} aria-hidden="true" focusable="false" />
        </button>
      ) : null}
      <button
        ref={bubble}
        type="button"
        className="tkn-chat-bubble"
        aria-expanded={open}
        aria-controls={open ? "tkn-chat-panel" : undefined}
        aria-label={open ? t("chat.close") : t("chat.open")}
        onClick={() => setOpen((value) => !value)}
      >
        <MessageCircle size={26} aria-hidden="true" focusable="false" />
      </button>
    </div>
  );
}
