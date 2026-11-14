"use client";

import { createContext, useContext, useState } from "react";
import dynamic from "next/dynamic";
import { MessageCircle, Phone, Video } from "lucide-react";
import { api, friendlyError, hasSessionHint } from "@/lib/ui/api";
import { tourRequestLabel } from "@/components/ad/tourLabels";

// The chat panel code loads only when a visitor opens the chat.
const ChatPanel = dynamic(() => import("@/components/chat/ChatPanel").then((mod) => mod.ChatPanel), { ssr: false });

type Channel = "phone" | "whatsapp" | "telegram";
type Reveal = { value: string; href?: string };
type Action = Channel | "chat" | "tour";
type Notice = { text: string; signIn?: boolean };
/** Set only when the server says a live video tour can be requested on this ad (H6.5). */
export type AdTour = { listingId: string; coins: number };

type Ctx = {
  shown: Partial<Record<Channel, Reveal>>;
  notice: Notice | null;
  busy: Action | null;
  tour: AdTour | null;
  tourRequested: boolean;
  open: (channel: Channel) => void;
  openChat: () => void;
  requestTour: () => void;
};

const ContactCtx = createContext<Ctx | null>(null);

async function reveal(slug: string | undefined, id: string | undefined, channel: Channel) {
  let listingId = id;
  if (!listingId && slug) {
    const pub = await api<{ id: string }>(`/api/listings/${encodeURIComponent(slug)}/`);
    if (!pub.ok) return { error: friendlyError(pub.error) };
    listingId = pub.data.id;
  }
  if (!listingId) return { error: "Contact is unavailable right now." };
  const res = await api<{ value?: string | null; deepLink?: string | null }>(`/api/listings/${listingId}/contact-reveal/`, {
    method: "POST",
    body: JSON.stringify({ channel }),
  });
  if (!res.ok) return { error: friendlyError(res.error) };
  if (!res.data.value && !res.data.deepLink) return { error: "This poster has not shared a contact method yet." };
  return { value: res.data.value || "", href: res.data.deepLink || undefined };
}

function signInHref() {
  const next = typeof window === "undefined" ? "/" : window.location.pathname;
  return `/u/login/?next=${encodeURIComponent(next)}`;
}

/** Holds the contact state for one ad: revealed contacts, the chat panel and the video tour request. */
export function ContactProvider({
  listingSlug,
  listingId,
  tour = null,
  children,
}: {
  listingSlug?: string;
  listingId?: string;
  tour?: AdTour | null;
  children: React.ReactNode;
}) {
  const [shown, setShown] = useState<Partial<Record<Channel, Reveal>>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [conversationId, setConversationId] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [tourRequested, setTourRequested] = useState(false);

  async function open(channel: Channel) {
    if (shown[channel]) return;
    setBusy(channel);
    setNotice(null);
    const result = await reveal(listingSlug, listingId, channel);
    setBusy(null);
    if ("error" in result && result.error) {
      setNotice({ text: result.error });
      return;
    }
    if ("value" in result) setShown((prev) => ({ ...prev, [channel]: { value: result.value || "", href: result.href } }));
  }

  async function openChat() {
    if (conversationId) return setChatOpen(true);
    if (!listingId) return setNotice({ text: "Chat is unavailable right now." });
    setBusy("chat");
    setNotice(null);
    const res = await api<{ conversationId: string }>("/api/chat/conversations", { method: "POST", body: JSON.stringify({ listingId }) });
    setBusy(null);
    if (res.ok) {
      setConversationId(res.data.conversationId);
      return setChatOpen(true);
    }
    if (res.status === 401) return setNotice({ text: "Sign in to chat with the advertiser.", signIn: true });
    setNotice({ text: friendlyError(res.error) });
  }

  async function requestTour() {
    if (!tour || tourRequested) return;
    if (!hasSessionHint()) return setNotice({ text: "Sign in to request a live video tour.", signIn: true });
    setBusy("tour");
    setNotice(null);
    const res = await api<{ id: string }>("/api/tours/request/",{ method: "POST", body: JSON.stringify({ listingId: tour.listingId }) });
    setBusy(null);
    if (res.ok) {
      setTourRequested(true);
      return setNotice({ text: "Request sent. The advertiser has 30 minutes to accept. The coins are held and refunded if the tour does not go ahead." });
    }
    if (res.status === 401) return setNotice({ text: "Sign in to request a live video tour.", signIn: true });
    setNotice({ text: friendlyError(res.error) });
  }

  const value: Ctx = { shown, notice, busy, tour, tourRequested, open, openChat, requestTour };
  return (
    <ContactCtx.Provider value={value}>
      {children}
      {chatOpen && conversationId ? <ChatPanel conversationId={conversationId} onClose={() => setChatOpen(false)} /> : null}
    </ContactCtx.Provider>
  );
}

function useContact() {
  const ctx = useContext(ContactCtx);
  if (!ctx) throw new Error("Contact buttons need a provider");
  return ctx;
}

function NoticeLine({ notice, sticky }: { notice: Notice | null; sticky?: boolean }) {
  if (!notice) return null;
  return (
    <p role="status" className={sticky ? "tk-bar-note" : "t-caption"} style={sticky ? undefined : { gridColumn: "1 / -1" }}>
      {notice.text}
      {notice.signIn ? (
        <>
          {" "}
          <a href={signInHref()} style={{ color: "var(--accent)", textDecoration: "underline" }}>
            Sign in
          </a>
        </>
      ) : null}
    </p>
  );
}

/**
 * The contact buttons, in this order: Call, WhatsApp, Chat online now, and the video tour when the server allows it.
 * Used twice per ad: in the desktop contact card and in the mobile sticky bar.
 */
export function ContactButtons({
  sticky,
  channels = ["phone", "whatsapp"],
}: {
  sticky?: boolean;
  channels?: Channel[];
}) {
  const { shown, notice, busy, tour, tourRequested, open, openChat, requestTour } = useContact();
  const channelButtons = channels.map((channel) => {
    const hit = shown[channel];
    if (hit?.value) {
      const href = hit.href || (channel === "phone" ? `tel:${hit.value}` : channel === "whatsapp" ? `https://wa.me/${hit.value.replace(/\D/g, "")}` : undefined);
      return (
        <a key={channel} className={channel === "whatsapp" ? "tk-btn tk-btn-whatsapp" : "tk-btn tk-btn-gold"} data-tk={channel === "phone" ? "call" : "whatsapp"} href={href}>
          {hit.value}
        </a>
      );
    }
    const label = channel === "phone" ? "Call" : channel === "whatsapp" ? "WhatsApp" : "Telegram";
    return (
      <button key={channel} type="button" className={channel === "whatsapp" ? "tk-btn tk-btn-whatsapp" : "tk-btn tk-btn-gold"} data-tk={channel === "phone" ? "call" : channel === "whatsapp" ? "whatsapp" : undefined} onClick={() => open(channel)} disabled={busy === channel}>
        {channel === "phone" ? <Phone size={16} aria-hidden /> : channel === "whatsapp" ? <Wa /> : null}
        {busy === channel ? "…" : label}
      </button>
    );
  });
  const buttons = [
    ...channelButtons,
    <button key="chat" type="button" className="tk-btn tk-btn-gold" data-tk="chat" onClick={() => void openChat()} disabled={busy === "chat"}>
      <MessageCircle size={16} aria-hidden /> {busy === "chat" ? "…" : "Chat online now"}
    </button>,
    tour ? (
      <button key="tour" type="button" className="tk-btn tk-btn-gold" data-tk="tour" onClick={() => void requestTour()} disabled={busy === "tour" || tourRequested} aria-busy={busy === "tour"}>
        <Video size={16} aria-hidden /> {busy === "tour" ? "…" : tourRequestLabel(tour.coins)}
      </button>
    ) : null,
  ];
  if (sticky) {
    return (
      <>
        {buttons}
        <NoticeLine notice={notice} sticky />
      </>
    );
  }
  return (
    <div className="tk-actions">
      {buttons}
      <NoticeLine notice={notice} />
    </div>
  );
}

function Wa() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="#fff" d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3z" />
    </svg>
  );
}
