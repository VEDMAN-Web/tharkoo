"use client";

import { createContext, useContext, useState } from "react";
import dynamic from "next/dynamic";
import { MessageCircle, Phone, Video } from "lucide-react";
import { api, friendlyError, hasSessionHint } from "@/lib/ui/api";
import { tourRequestLabel } from "@/components/ad/tourLabels";
import { useSellerStatus, type SellerStatus } from "@/components/availability/sellerStatus";
import { AvailabilityBadge } from "@/components/availability/AvailabilityBadge";
import { AdPopup, type AdPopupAlt, type FlowResult, type PopupKind } from "@/components/new/AdPopup";
import { useT } from "@/components/ui/AdCard";

// The chat panel code loads only when a visitor opens the chat.
const ChatPanel = dynamic(() => import("@/components/chat/ChatPanel").then((mod) => mod.ChatPanel), { ssr: false });

type Channel = "phone" | "whatsapp" | "telegram";
type Reveal = { value: string; href?: string };
type Action = Channel | "chat" | "tour";
type Notice = { text: string; signIn?: boolean };
/** Set only when the server says a live video tour can be requested on this ad (H6.5). */
export type AdTour = { listingId: string; coins: number };

/** H7.5: shown when a visitor asks for a seller's number while the seller is Away. Chat still works. */
export const CALLS_PAUSED = "The seller is away, so calls are paused. You can still chat.";

/** Shown instead of a coin purchase until a real coin provider is set in production. */
export const COIN_PURCHASE_SOON = "Coin purchases open soon. No coins were used.";

/** H7.9: what the ad page's pop-up needs to know about the ad's seller and the similar ads. */
export type ContactPopupInfo = {
  sellerName: string;
  /** True only when a real coin provider is set (server check). Until then the pop-up says purchases open soon. */
  paymentsLive: boolean;
  alternatives: AdPopupAlt[];
};

type Ctx = {
  shown: Partial<Record<Channel, Reveal>>;
  notice: Notice | null;
  busy: Action | null;
  tour: AdTour | null;
  tourRequested: boolean;
  open: (channel: Channel) => void;
  /** Chat button: opens the chat, or the log-in step first when the visitor is not signed in. */
  openChatFlow: () => void;
  /** Video call button: opens the video call and verify pop-up. */
  openCall: () => void;
  /** H7.5: the ad seller Online now or Away. Calls pause while Away; chat does not. */
  seller: SellerStatus | undefined;
  /** H7.5: people ads have no video call and verify button. Call, WhatsApp and chat stay. */
  people: boolean;
  info: ContactPopupInfo;
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

const NO_INFO: ContactPopupInfo = { sellerName: "", paymentsLive: false, alternatives: [] };

/** Holds the contact state for one ad: revealed contacts, the chat panel, and the video call and verify pop-up. */
export function ContactProvider({
  listingSlug,
  listingId,
  tour = null,
  peopleAd = false,
  info = NO_INFO,
  children,
}: {
  listingSlug?: string;
  listingId?: string;
  tour?: AdTour | null;
  /** H7.5: the ad is in a people category (server check). No video call button; Call, WhatsApp and chat stay. */
  peopleAd?: boolean;
  info?: ContactPopupInfo;
  children: React.ReactNode;
}) {
  const [shown, setShown] = useState<Partial<Record<Channel, Reveal>>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [conversationId, setConversationId] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [tourRequested, setTourRequested] = useState(false);
  const [popup, setPopup] = useState<PopupKind | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const seller = useSellerStatus(listingSlug);
  const people = peopleAd || seller?.people === true;

  async function open(channel: Channel) {
    if (shown[channel]) return;
    if (channel === "phone" && seller?.callsAllowed === false) {
      return setNotice({ text: CALLS_PAUSED });
    }
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

  /** Opens the chat thread. Returns "auth" when the server says the visitor must log in first. */
  async function startChat(): Promise<FlowResult> {
    if (conversationId) {
      setChatOpen(true);
      return "ok";
    }
    if (!listingId) {
      setNotice({ text: "Chat is unavailable right now." });
      return "error";
    }
    setBusy("chat");
    setNotice(null);
    const res = await api<{ conversationId: string }>("/api/chat/conversations", { method: "POST", body: JSON.stringify({ listingId }) });
    setBusy(null);
    if (res.ok) {
      setConversationId(res.data.conversationId);
      setChatOpen(true);
      return "ok";
    }
    if (res.status === 401) {
      setSignedIn(false);
      return "auth";
    }
    setNotice({ text: friendlyError(res.error) });
    return "error";
  }

  /** Asks for the live video tour. The server holds the coins; a visitor without enough coins gets "coins". */
  async function startCall(): Promise<FlowResult> {
    if (!tour) return "error";
    if (tourRequested) return "ok";
    if (!signedIn && !hasSessionHint()) return "auth";
    setBusy("tour");
    setNotice(null);
    const res = await api<{ id: string }>("/api/tours/request/", { method: "POST", body: JSON.stringify({ listingId: tour.listingId }) });
    setBusy(null);
    if (res.ok) {
      setTourRequested(true);
      return "ok";
    }
    if (res.status === 401) {
      setSignedIn(false);
      return "auth";
    }
    // H7.4: no coin provider is live yet, so a visitor without coins is told purchases are coming, never shown a fake success.
    if (res.status === 402) return "coins";
    setNotice({ text: friendlyError(res.error) });
    return "error";
  }

  // The log-in state is read from the session cookie when a button is pressed (it is not known during server rendering).
  function openCall() {
    setNotice(null);
    setSignedIn(hasSessionHint());
    setPopup("call");
  }

  async function openChatFlow() {
    const ready = hasSessionHint();
    setSignedIn(ready);
    if (!ready) return setPopup("chat");
    const result = await startChat();
    if (result === "auth") setPopup("chat");
  }

  function closePopup() {
    setPopup(null);
    setNotice(null);
  }

  const value: Ctx = { shown, notice, busy, tour, tourRequested, open, openChatFlow: () => void openChatFlow(), openCall, seller, people, info };
  return (
    <ContactCtx.Provider value={value}>
      {children}
      {popup ? (
        <AdPopup
          kind={popup}
          name={info.sellerName || "the seller"}
          signedIn={signedIn}
          seller={seller}
          tourCoins={tour && !people ? tour.coins : null}
          paymentsLive={info.paymentsLive}
          alternatives={info.alternatives}
          notice={notice?.text ?? null}
          onClose={closePopup}
          onSignedIn={() => setSignedIn(true)}
          onStartCall={startCall}
          onStartChat={startChat}
          onSwitchToChat={() => {
            closePopup();
            void openChatFlow();
          }}
        />
      ) : null}
      {chatOpen && conversationId ? <ChatPanel conversationId={conversationId} onClose={() => setChatOpen(false)} /> : null}
    </ContactCtx.Provider>
  );
}

/** The contact state for this ad. Used by the New design's contact panel and mobile bar. */
export function useContact() {
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
  const { shown, notice, busy, tour, tourRequested, open, openChatFlow, openCall, seller, people } = useContact();
  const t = useT();
  const callsPaused = seller?.callsAllowed === false;
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
      <button key={channel} type="button" className={channel === "whatsapp" ? "tk-btn tk-btn-whatsapp" : "tk-btn tk-btn-gold"} data-tk={channel === "phone" ? "call" : channel === "whatsapp" ? "whatsapp" : undefined} onClick={() => open(channel)} disabled={busy === channel || (channel === "phone" && callsPaused)} aria-describedby={channel === "phone" && callsPaused ? "tk-calls-paused" : undefined}>
        {channel === "phone" ? <Phone size={16} aria-hidden /> : channel === "whatsapp" ? <Wa /> : null}
        {busy === channel ? "…" : label}
      </button>
    );
  });
  const buttons = [
    ...channelButtons,
    <button key="chat" type="button" className="tk-btn tk-btn-gold" data-tk="chat" onClick={() => openChatFlow()} disabled={busy === "chat"}>
      {seller ? <span className="tkn-dot" data-status={seller.status} aria-hidden /> : null}
      <MessageCircle size={16} aria-hidden /> {busy === "chat" ? "…" : t("ad.chat")}
    </button>,
    tour && !people ? (
      <button key="tour" type="button" className="tk-btn tk-btn-gold" data-tk="tour" onClick={() => openCall()} disabled={busy === "tour" || tourRequested} aria-busy={busy === "tour"}>
        <Video size={16} aria-hidden /> {busy === "tour" ? "…" : tourRequested ? "Request sent" : tourRequestLabel(tour.coins)}
      </button>
    ) : null,
  ];
  const pausedLine = callsPaused && channels.includes("phone") ? <p id="tk-calls-paused" className="t-caption" data-tk="calls-paused" style={{ gridColumn: "1 / -1" }}>{CALLS_PAUSED}</p> : null;
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
      {pausedLine}
      <NoticeLine notice={notice} />
    </div>
  );
}

/** H7.5: the Online now / Away badge for the ad's seller, shown in the contact panel. */
export function ContactAvailability() {
  const { seller } = useContact();
  return seller ? <AvailabilityBadge status={seller.status} /> : null;
}

function Wa() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="#fff" d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3z" />
    </svg>
  );
}
