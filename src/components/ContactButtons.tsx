"use client";

import { trackEvent } from "@/lib/analytics/ga";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MessageCircle, Phone, Video } from "lucide-react";
import { api, friendlyError, hasSessionHint } from "@/lib/ui/api";
import { tourRequestLabel } from "@/components/ad/tourLabels";
import { useSellerStatus, type SellerStatus } from "@/components/availability/sellerStatus";
import { AvailabilityBadge } from "@/components/availability/AvailabilityBadge";
import { AdPopup, type AdPopupAlt, type FlowResult, type PopupKind } from "@/components/new/AdPopup";
import { useT } from "@/components/ui/AdCard";
import { openSignInFromLink } from "@/components/auth/SignInSheet";

// The chat panel code loads only when a visitor opens the chat.
const ChatPanel = dynamic(() => import("@/components/chat/ChatPanel").then((mod) => mod.ChatPanel), { ssr: false });

type Channel = "phone" | "whatsapp" | "telegram";
type Reveal = { value: string; href?: string };
type Action = Channel | "chat" | "tour";
type Notice = { text: string; signIn?: boolean; post?: { label: string; href: string } };
/** Set only when the server says a live video tour can be requested on this ad (H6.5). */
export type AdTour = { listingId: string; coins: number };

/** Shown instead of a coin purchase until a real coin provider is set in production. */
export const COIN_PURCHASE_SOON = "Credit purchases open soon. No credits were used.";

/** H16.5: on a sample (demo) ad every contact button shows this message and a Post an ad button; nobody is contacted. */
export type SampleNote = { message: string; button: string; href: string };

export type ContactPopupInfo = {
  sellerName: string;
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
  openChatFlow: () => void;
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

export function ContactProvider({
  listingSlug,
  listingId,
  tour = null,
  peopleAd = false,
  info = NO_INFO,
  sample = null,
  children,
}: {
  listingSlug?: string;
  listingId?: string;
  tour?: AdTour | null;
  /** H7.5: the ad is in a people category (server check). No video call button; Call, WhatsApp and chat stay. */
  peopleAd?: boolean;
  info?: ContactPopupInfo;
  sample?: SampleNote | null;
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
  // H17.1: a sample ad has nobody behind it, so there is no Online now or Away to show.
  const seller = useSellerStatus(sample ? undefined : listingSlug);
  const people = peopleAd || seller?.people === true;

  function showSample() {
    if (!sample) return false;
    setNotice({ text: sample.message, post: { label: sample.button, href: sample.href } });
    return true;
  }

  async function open(channel: Channel) {
    if (showSample()) return;
    // H17.11: a real ad only (a sample ad returned above). Telegram is not one of the counted methods.
    if (channel !== "telegram") trackEvent("contact_click", { method: channel === "phone" ? "call" : channel });
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

  async function startChat(): Promise<FlowResult> {
    if (!listingId) {
      setNotice({ text: "Chat is unavailable right now." });
      return "error";
    }
    if (!hasSessionHint()) {
      setSignedIn(false);
      return "auth";
    }
    setNotice(null);
    setChatOpen(true);
    return "ok";
  }

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

  function openCall() {
    if (showSample()) return;
    setNotice(null);
    setSignedIn(hasSessionHint());
    setPopup("call");
  }

  async function openChatFlow() {
    if (showSample()) return;
    trackEvent("contact_click", { method: "chat" });
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

  // H7.131: a link with ?chat=1 (the Chat button on a card) opens the chat on this ad, once. A guest gets the sign-in step first.
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || !listingId) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("chat") !== "1") return;
    deepLinked.current = true;
    params.delete("chat");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    const id = window.setTimeout(() => void openChatFlow(), 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  const value: Ctx = { shown, notice, busy, tour, tourRequested, open, openChatFlow: () => void openChatFlow(), openCall, seller, people, info };
  return (
    <ContactCtx.Provider value={value}>
      {children}
      {popup ? (
        <AdPopup
          kind={popup}
          name={info.sellerName || "the advertiser"}
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
      {chatOpen && listingId ? (
        <ChatPanel
          listingId={listingId}
          peerName={info.sellerName || "the advertiser"}
          conversationId={conversationId}
          onConversation={setConversationId}
          onClose={() => setChatOpen(false)}
        />
      ) : null}
    </ContactCtx.Provider>
  );
}

export function useContact() {
  const ctx = useContext(ContactCtx);
  if (!ctx) throw new Error("Contact buttons need a provider");
  return ctx;
}

function NoticeLine({ notice, sticky }: { notice: Notice | null; sticky?: boolean }) {
  if (!notice) return null;
  return (
    <p role="status" data-tk={notice.post ? "sample-note" : undefined} className={sticky ? "tk-bar-note" : "t-caption"} style={sticky ? undefined : { gridColumn: "1 / -1" }}>
      {notice.text}
      {notice.post ? (
        <>
          {" "}
          <a className="tk-btn" data-tk="sample-post" href={notice.post.href} style={{ marginTop: 6 }}>
            {notice.post.label}
          </a>
        </>
      ) : null}
      {notice.signIn ? (
        <>
          {" "}
          <a href={signInHref()} style={{ color: "var(--accent)", textDecoration: "underline" }} onClick={(event) => openSignInFromLink(event)}>
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
  const channelButtons = channels.map((channel) => {
    const hit = shown[channel];
    if (hit?.value) {
      const href = hit.href || (channel === "phone" ? `tel:${hit.value}` : channel === "whatsapp" ? `https://wa.me/${hit.value.replace(/\D/g, "")}` : undefined);
      return (
        <a key={channel} className={channel === "whatsapp" ? "tk-btn tk-btn-whatsapp" : "tk-btn"} data-tk={channel === "phone" ? "call" : "whatsapp"} href={href}>
          {hit.value}
        </a>
      );
    }
    const label = channel === "phone" ? "Call" : channel === "whatsapp" ? "WhatsApp" : "Telegram";
    return (
      <button key={channel} type="button" className={channel === "whatsapp" ? "tk-btn tk-btn-whatsapp" : "tk-btn"} data-tk={channel === "phone" ? "call" : channel === "whatsapp" ? "whatsapp" : undefined} onClick={() => open(channel)} disabled={busy === channel}>
        {channel === "phone" ? <Phone size={16} aria-hidden /> : channel === "whatsapp" ? <Wa /> : null}
        {busy === channel ? "…" : label}
      </button>
    );
  });
  const buttons = [
    ...channelButtons,
    <button key="chat" type="button" className="tk-btn" data-tk="chat" onClick={() => openChatFlow()} disabled={busy === "chat"}>
      {seller ? <span className="tkn-dot" data-status={seller.status} aria-hidden /> : null}
      <MessageCircle size={16} aria-hidden /> {busy === "chat" ? "…" : t(sticky ? "ad.bar.chat" : "ad.chat")}
    </button>,
    tour && !people ? (
      <button key="tour" type="button" className="tk-btn" data-tk="tour" onClick={() => openCall()} disabled={busy === "tour" || tourRequested} aria-busy={busy === "tour"}>
        <Video size={16} aria-hidden /> {busy === "tour" ? "…" : tourRequested ? "Request sent" : sticky ? barVideoLabel(t, tour.coins) : tourRequestLabel(tour.coins)}
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

/** H7.5: the Online now / Away badge for the ad's seller, shown in the contact panel. */
export function ContactAvailability() {
  const { seller } = useContact();
  // H7.4c: the badge shows only when the seller has Live chat on.
  return seller && seller.chatOn ? <AvailabilityBadge status={seller.status} /> : null;
}

function barVideoLabel(t: (key: "ad.bar.videoOne" | "ad.bar.videoMany", params?: Record<string, string | number>) => string, coins: number) {
  return coins === 1 ? t("ad.bar.videoOne") : t("ad.bar.videoMany", { coins });
}

function Wa() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="#fff" d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3z" />
    </svg>
  );
}
