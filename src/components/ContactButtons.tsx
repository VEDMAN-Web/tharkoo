"use client";

import { trackEvent } from "@/lib/analytics/ga";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MessageCircle, Phone, Video } from "lucide-react";
import { api, friendlyError, hasSessionHint } from "@/lib/ui/api";
import { tourRequestLabel } from "@/components/ad/tourLabels";
import { callPage, isOpenTour, useTours } from "@/components/tours/useTours";
import { useSellerStatus, type SellerStatus } from "@/components/availability/sellerStatus";
import { AvailabilityBadge } from "@/components/availability/AvailabilityBadge";
import { AdPopup, type AdPopupAlt, type FlowResult, type PopupKind } from "@/components/new/AdPopup";
import { useT } from "@/components/ui/AdCard";
import { openSignInFromLink } from "@/components/auth/SignInSheet";
import Link from "next/link";
import { useAccount } from "@/components/account/AccountContext";
import { openPromote } from "@/components/promote/openPromote";
import { draftPath } from "@/lib/ui/ad-status";

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
  /** The advertiser accepted this visitor's request: the button opens the call itself. */
  joinTourId: string | null;
  open: (channel: Channel) => void;
  openChatFlow: () => void;
  openCall: () => void;
  /** H7.5: the ad seller Online now or Away. Calls pause while Away; chat does not. */
  seller: SellerStatus | undefined;
  /** H7.5: people ads have no video call and verify button. Call, WhatsApp and chat stay. */
  people: boolean;
  info: ContactPopupInfo;
  /** H19.2: the signed-in visitor is the vendor of this ad: no Chat or Video call, but Edit and Boost. */
  isOwner: boolean;
  listingId?: string;
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
  ownerId,
  children,
}: {
  listingSlug?: string;
  listingId?: string;
  tour?: AdTour | null;
  /** H7.5: the ad is in a people category (server check). No video call button; Call, WhatsApp and chat stay. */
  peopleAd?: boolean;
  info?: ContactPopupInfo;
  sample?: SampleNote | null;
  /** H19.2: the id of the vendor who posted the ad (the page is cached, so the owner is found in the browser). */
  ownerId?: string;
  children: React.ReactNode;
}) {
  const account = useAccount();
  const isOwner = Boolean(ownerId && (account.user as { id?: string } | null)?.id === ownerId);
  const [shown, setShown] = useState<Partial<Record<Channel, Reveal>>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [conversationId, setConversationId] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [tourRequestedRaw, setTourRequested] = useState(false);
  const [tourId, setTourId] = useState<string | null>(null);
  const [popup, setPopup] = useState<PopupKind | null>(null);
  // While no pop-up is open, read the visitor's own calls from the server: the button stays right after a refresh or a
  // page change, and goes back to normal once the request is declined, cancelled or over. (A guest is not asked.)
  const { rows: myTours } = useTours({ enabled: Boolean(tour) && !sample && !isOwner && popup === null });
  const openRow = tour ? myTours?.find((row) => row.role === "buyer" && row.listingId === tour.listingId && isOpenTour(row)) : undefined;
  const watched = tourId ? myTours?.find((row) => row.id === tourId) : undefined;
  const tourRequested = Boolean(openRow) || (tourRequestedRaw && !(watched && !isOpenTour(watched)));
  const openTourId = openRow?.id ?? tourId;
  const joinTourId = openRow?.status === "accepted" ? openRow.id : null;
  const [paidAdded, setPaidAdded] = useState<number | null>(null);
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
      setTourId(res.data.id);
      setTourRequested(true);
      return "ok";
    }
    if (res.status === 401) {
      setSignedIn(false);
      return "auth";
    }
    // H7.4: no coin provider is live yet, so a visitor without coins is told purchases are coming, never shown a fake success.
    if (res.status === 402) return "coins";
    // H18.17: a request for this ad is already open (waiting, or accepted and not finished). Find it, so the pop-up shows its
    // real state (the line, or Join now) and not a made-up "sent".
    if (res.status === 409 && /open tour request/i.test(res.error?.message ?? "")) {
      const list = await api<{ id: string; listingId: string; role: string; status: string }[]>("/api/tours").catch(() => null);
      const open = list?.ok ? list.data.find((row) => row.listingId === tour.listingId && row.role === "buyer" && (row.status === "requested" || row.status === "accepted")) : undefined;
      setTourId(open?.id ?? null);
      setTourRequested(true);
      return "ok";
    }
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

  // H19.3: ?call=1 (the way back from buying call credits inside the video call pop-up) opens the pop-up again on this ad, once.
  // ?paid=1&added=N says what was just added, so the pop-up shows "Recharge successful" with the Start video call button ready.
  const callLinked = useRef(false);
  useEffect(() => {
    if (callLinked.current || !listingId || !tour || sample) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("call") !== "1") return;
    callLinked.current = true;
    const added = Number(params.get("added"));
    const paid = params.get("paid") === "1" && Number.isFinite(added) && added > 0;
    for (const key of ["call", "paid", "added"]) params.delete(key);
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    const id = window.setTimeout(() => {
      setPaidAdded(paid ? added : null);
      setSignedIn(hasSessionHint());
      setPopup("call");
    }, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId, tour, sample]);

  const value: Ctx = { shown, notice, busy, tour, tourRequested, joinTourId, open,openChatFlow: () => void openChatFlow(), openCall, seller, people, info, isOwner, listingId };
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
          paidAdded={paidAdded}
          tourId={openTourId}
          openRequest={tourRequested}
          onCallEnded={() => setTourRequested(false)}
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
  const { shown, notice, busy, tour, tourRequested, joinTourId, open, openChatFlow, openCall, seller, people, isOwner, listingId } = useContact();
  const t = useT();
  if (isOwner && listingId) {
    return (
      <div className={sticky ? "tk-owner-bar" : "tk-actions tk-owner-box"} data-tk="owner-actions">
        <p className="tk-owner-note">{t("ad.owner.title")}</p>
        <Link href={draftPath(listingId)} className="tk-btn" data-tk="owner-edit">{t("ad.owner.edit")}</Link>
        <button type="button" className="tk-btn" data-tk="owner-boost" onClick={() => openPromote({ listingId })}>{t("ad.owner.boost")}</button>
      </div>
    );
  }
  const channelButtons = channels.map((channel) => {
    const hit = shown[channel];
    if (hit?.value) {
      const href = hit.href || (channel === "phone" ? `tel:${hit.value}` : channel === "whatsapp" ? `https://wa.me/${hit.value.replace(/\D/g, "")}` : undefined);
      return (
        <a key={channel} className={channel === "whatsapp" ? "tk-btn tk-btn-whatsapp" : "tk-btn"} data-tk={channel === "phone" ? "call" : "whatsapp"} href={href}>
          {channel === "phone" ? <Phone size={16} aria-hidden /> : <Wa />}
          <span className="tk-btn-label">{hit.value}</span>
        </a>
      );
    }
    const label = channel === "phone" ? "Call" : channel === "whatsapp" ? "WhatsApp" : "Telegram";
    return (
      <button key={channel} type="button" className={channel === "whatsapp" ? "tk-btn tk-btn-whatsapp" : "tk-btn"} data-tk={channel === "phone" ? "call" : channel === "whatsapp" ? "whatsapp" : undefined} onClick={() => open(channel)} disabled={busy === channel}>
        {channel === "phone" ? <Phone size={16} aria-hidden /> : channel === "whatsapp" ? <Wa /> : null}
        <span className="tk-btn-label">{busy === channel ? "…" : label}</span>
      </button>
    );
  });
  const buttons = [
    ...channelButtons,
    <button key="chat" type="button" className="tk-btn" data-tk="chat" onClick={() => openChatFlow()} disabled={busy === "chat"}>
      {seller ? <span className="tkn-dot" data-status={seller.status} aria-hidden /> : null}
      <MessageCircle size={16} aria-hidden /> <span className="tk-btn-label">{busy === "chat" ? "…" : t(sticky ? "ad.bar.chat" : "ad.chat")}</span>
    </button>,
    tour && !people ? (
      joinTourId ? (
        <Link key="tour" href={callPage(joinTourId)} className="tk-btn" data-tk="tour" data-state="accepted">
          <Video size={16} aria-hidden /> <span className="tk-btn-label">{t("ad.calling.join")}</span>
        </Link>
      ) : (
        <button key="tour" type="button" className="tk-btn" data-tk="tour" data-state={tourRequested ? "waiting" : undefined} onClick={() => openCall()} disabled={busy === "tour"} aria-busy={busy === "tour"}>
          <Video size={16} aria-hidden /> <span className="tk-btn-label">{busy === "tour" ? "…" : tourRequested ? t(sticky ? "ad.calling.sent" : "ad.calling.sentView") : sticky ? barVideoLabel(t, tour.coins) : tourRequestLabel(tour.coins)}</span>
        </button>
      )
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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: "none" }}>
      <path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3z" />
      <path d="M9.2 8.6c-.3.6-.2 1.4.4 2.4 1 1.7 2.4 2.9 4.2 3.5.7.2 1.3-.1 1.6-.7l-1.5-1-.8.5c-.8-.4-1.6-1.2-2-2l.5-.8-1-1.5-1.4.6z" fill="#fff" stroke="none" />
    </svg>
  );
}
