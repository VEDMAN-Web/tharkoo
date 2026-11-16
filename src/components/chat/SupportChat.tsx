"use client";

import { ArrowUp, MessageCircle, Phone, Send, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, TouchEvent } from "react";
import { usePathname } from "next/navigation";
import { useUrlPaths } from "@/components/UrlPaths";
import { safeHref } from "@/lib/sanitize";
import { useDismiss } from "@/components/ui/useDismiss";
import { api, friendlyError, hasSessionHint } from "@/lib/ui/api";
import { isSupportOpen, openingLabel, parseSupportHours } from "@/lib/support-hours";
import { makeT, type UiTextMap } from "@/lib/ui/text";
import type { ShellConfig } from "@/server/site-links/shell-config-rules";
import { SUBJECT_MAX, TOPIC_LABELS, type SupportTopic } from "@/server/support/constants";
import { ArticleCards, GuestForm, type ChatArticle, type ChatLine } from "./SupportChatParts";

type Chat = ShellConfig["chat"];
type Session = "unknown" | "guest" | "member";
type LineInput = { kind: "text"; from: "you" | "support"; text: string } | { kind: "articles"; articles: ChatArticle[]; loading: boolean };

const BODY_MIN = 10;
const BACK_TO_TOP_AFTER = 300;
const SWIPE_CLOSE_PX = 60;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s-]{8,20}$/;

function callLink(value: string) {
  const digits = value.replace(/^tel:/i, "").replace(/[^+\d]/g, "");
  return digits.replace(/\D/g, "").length >= 8 ? `tel:${digits}` : "";
}

function ticketBody(parts: string[], topic: SupportTopic) {
  const text = parts.join("\n").trim();
  return text.length >= BODY_MIN ? text : `${text} (${TOPIC_LABELS[topic]})`.trim();
}

export function SupportChat({ chat, texts, hours = "" }: { chat: Chat; texts?: UiTextMap; hours?: string }) {
  const t = useMemo(() => makeT(texts), [texts]);
  const supportHours = useMemo(() => parseSupportHours(hours), [hours]);
  const path = usePathname() || "/";
  const paths = useUrlPaths();
  const section = path.split("/")[1];
  const pageBars = section === "u" || section === paths.ad;
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState(false);
  const [session, setSession] = useState<Session>("unknown");
  const [topic, setTopic] = useState<SupportTopic>("something_else");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [pending, setPending] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showTop, setShowTop] = useState(false);
  const [guest, setGuest] = useState({ name: "", contact: "" });
  const [guestError, setGuestError] = useState("");
  const [contactOpen, setContactOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const nextLine = useRef(0);
  const swipeStart = useRef<number | null>(null);
  const bubble = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const float = useRef<HTMLDivElement>(null);

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

  const closePanel = useCallback(() => setOpen(false), []);
  useDismiss(open, float, closePanel);

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

  useEffect(() => {
    const body = bodyRef.current;
    if (body) body.scrollTop = body.scrollHeight;
  }, [lines, contactOpen, sent]);

  function toggle() {
    if (!open) setOnline(isSupportOpen(supportHours, new Date()));
    setOpen((value) => !value);
  }

  function add(line: LineInput) {
    nextLine.current += 1;
    const id = nextLine.current;
    setLines((rows) => [...rows, { ...line, id }]);
    return id;
  }

  async function tapQuick(item: Chat["topics"][number]) {
    setTopic(item.topic);
    setPending((rows) => [...rows, item.label]);
    add({ kind: "text", from: "you", text: item.label });
    const id = add({ kind: "articles", articles: [], loading: true });
    const res = await api<ChatArticle[]>(`/api/support-articles?topic=${item.topic}&q=${encodeURIComponent(item.label)}`);
    setLines((rows) => rows.map((row) => (row.id === id && row.kind === "articles" ? { ...row, articles: res.ok ? res.data : [], loading: false } : row)));
  }

  async function openMemberTicket(text: string) {
    setBusy(true);
    setError("");
    const res = ticketId
      ? await api<unknown>(`/api/support/tickets/${ticketId}/messages`, { method: "POST", body: JSON.stringify({ body: text }) })
      : await api<{ id: string }>("/api/support/tickets", {
          method: "POST",
          body: JSON.stringify({ topic, subject: text.slice(0, SUBJECT_MAX), body: text }),
        });
    setBusy(false);
    if (!res.ok) {
      setError(friendlyError(res.error));
      return false;
    }
    const first = !ticketId;
    if (first && res.data && typeof res.data === "object" && "id" in res.data) setTicketId(String(res.data.id));
    add({ kind: "text", from: "support", text: t("chat.sent") });
    setPending([]);
    return true;
  }

  function talk() {
    if (session === "member") {
      void openMemberTicket(ticketBody(pending, topic));
      return;
    }
    setContactOpen(true);
  }

  async function sendFree(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (text.length < BODY_MIN) return setError(t("chat.composer.minLength", { count: BODY_MIN }));
    setError("");
    if (session === "member") {
      add({ kind: "text", from: "you", text });
      setDraft("");
      await openMemberTicket(text);
      return;
    }
    add({ kind: "text", from: "you", text });
    setPending((rows) => [...rows, text]);
    setDraft("");
    setContactOpen(true);
  }

  async function submitGuest(event: FormEvent) {
    event.preventDefault();
    const name = guest.name.trim();
    const contact = guest.contact.trim();
    if (name.length < 2) return setGuestError(t("chat.guest.needName"));
    const byEmail = EMAIL.test(contact);
    if (!byEmail && !PHONE.test(contact)) return setGuestError(t("chat.guest.needContact"));
    setGuestError("");
    setBusy(true);
    const res = await api<{ replyVia: "email" | "phone"; emailed: boolean }>("/api/support/guest/tickets", {
      method: "POST",
      body: JSON.stringify({ name, email: byEmail ? contact : "", phone: byEmail ? "" : contact, topic, body: ticketBody(pending, topic) }),
    });
    setBusy(false);
    if (!res.ok) return setGuestError(friendlyError(res.error));
    setSent(true);
    setContactOpen(false);
    setPending([]);
    add({ kind: "text", from: "support", text: res.data.replyVia === "email" ? t("chat.sent") : t("chat.guest.replyPhone") });
  }

  function onSwipeEnd(event: TouchEvent) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (start !== null && event.changedTouches[0].clientY - start > SWIPE_CLOSE_PX) setOpen(false);
  }

  const whatsapp = safeHref(chat.whatsapp);
  const telegram = safeHref(chat.telegram);
  const call = callLink(chat.phone);
  const quick = [
    whatsapp ? { label: "WhatsApp", href: whatsapp, icon: "wa" } : null,
    telegram ? { label: "Telegram", href: telegram, icon: "tg" } : null,
    call ? { label: "Call", href: call, icon: "call" } : null,
  ].filter((item): item is { label: string; href: string; icon: string } => item !== null);
  const guestLocked = session !== "member" && sent;
  const canTalk = !sent && !contactOpen;
  const status = online ? t("chat.status.online") : t("chat.status.offline", { time: openingLabel(supportHours) });
  const floatClass = ["tkn-float", pageBars ? "tkn-float-pagebars" : "", section === "u" ? "tkn-float-panel" : "", open ? "tkn-float-open" : ""].filter(Boolean).join(" ");

  return (
    <div className={floatClass} ref={float}>
      {open ? (
        <section aria-label={chat.title} className="tkn-chatbox" id="tkn-chat-panel" data-tk="support-chat">
          <div
            className="tkn-chat-head"
            onTouchStart={(event) => {
              swipeStart.current = event.touches[0].clientY;
            }}
            onTouchEnd={onSwipeEnd}
          >
            <span className="tkn-mark" aria-hidden="true">t</span>
            <div className="tkn-chat-title">
              <strong>{chat.title}</strong>
              <span className="tkn-chat-status" data-tk="chat-status" data-online={online ? "yes" : "no"}>
                <span className={online ? "tkn-dot" : "tkn-dot tkn-dot-off"} aria-hidden="true" />
                {status}
              </span>
            </div>
            <button type="button" className="tkn-chat-close" aria-label={t("chat.closePanel")} onClick={closePanel}>
              <X size={20} aria-hidden="true" focusable="false" />
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
          <div className="tkn-chat-body" aria-live="polite" ref={bodyRef}>
            <p className="tkn-bubble tkn-bubble-in">{chat.welcome}</p>
            <div className="tkn-topics" role="group" aria-label={t("chat.topicsLabel")}>
              {chat.topics.map((item) => (
                <button key={item.label} type="button" className="tkn-chip" data-tk="chat-quick" onClick={() => void tapQuick(item)}>
                  {item.label}
                </button>
              ))}
            </div>
            {lines.map((line) =>
              line.kind === "articles" ? (
                <ArticleCards key={line.id} line={line} t={t} canTalk={canTalk} onTalk={talk} />
              ) : (
                <p key={line.id} className={line.from === "you" ? "tkn-bubble tkn-bubble-you" : "tkn-bubble tkn-bubble-in"}>{line.text}</p>
              ),
            )}
            {contactOpen && !sent ? <GuestForm hint={chat.guestHint} t={t} value={guest} error={guestError} busy={busy} onChange={setGuest} onSubmit={submitGuest} /> : null}
            {error ? <p className="tkn-error" role="alert">{error}</p> : null}
          </div>
          <form className="tkn-composer" onSubmit={sendFree}>
            <label className="tkn-sr" htmlFor="tkn-chat-input">{t("chat.composer.label")}</label>
            <input
              id="tkn-chat-input"
              value={draft}
              placeholder={guestLocked ? t("chat.sent.placeholder") : t("chat.composer.placeholder")}
              maxLength={4000}
              disabled={guestLocked}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit" className="tkn-send" aria-label={t("chat.composer.send")} disabled={busy || guestLocked}>
              <Send size={18} aria-hidden="true" focusable="false" />
            </button>
          </form>
        </section>
      ) : null}
      {showTop && !open ? (
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
        onClick={toggle}
      >
        <MessageCircle size={26} aria-hidden="true" focusable="false" />
      </button>
    </div>
  );
}
