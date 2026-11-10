"use client";

import { createContext, useContext, useState } from "react";
import { Phone } from "lucide-react";
import { api, friendlyError } from "@/lib/ui/api";

type Channel = "phone" | "whatsapp" | "telegram";
type Reveal = { value: string; href?: string };
type Ctx = {
  shown: Partial<Record<Channel, Reveal>>;
  message: string;
  busy: Channel | null;
  open: (channel: Channel) => void;
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

export function ContactProvider({
  listingSlug,
  listingId,
  children,
}: {
  listingSlug?: string;
  listingId?: string;
  children: React.ReactNode;
}) {
  const [shown, setShown] = useState<Partial<Record<Channel, Reveal>>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<Channel | null>(null);

  async function open(channel: Channel) {
    if (shown[channel]) return;
    setBusy(channel);
    setMessage("");
    const result = await reveal(listingSlug, listingId, channel);
    setBusy(null);
    if ("error" in result && result.error) {
      setMessage(result.error);
      return;
    }
    if ("value" in result) setShown((prev) => ({ ...prev, [channel]: { value: result.value || "", href: result.href } }));
  }

  return <ContactCtx.Provider value={{ shown, message, busy, open }}>{children}</ContactCtx.Provider>;
}

function useContact() {
  const ctx = useContext(ContactCtx);
  if (!ctx) throw new Error("Contact buttons need a provider");
  return ctx;
}

export function ContactButtons({
  sticky,
  channels = ["phone", "whatsapp"],
}: {
  phone?: string | null;
  whatsapp?: string | null;
  telegram?: string | null;
  compact?: boolean;
  sticky?: boolean;
  listingSlug?: string;
  listingId?: string;
  revealOnly?: boolean;
  channels?: Channel[];
}) {
  const { shown, message, busy, open } = useContact();
  const buttons = channels.map((channel) => {
    const hit = shown[channel];
    const label = channel === "phone" ? "Call" : channel === "whatsapp" ? "WhatsApp" : "Telegram";
    const tk = channel === "phone" ? "call" : channel === "whatsapp" ? "whatsapp" : undefined;
    if (hit?.value) {
      const href = hit.href || (channel === "phone" ? `tel:${hit.value}` : channel === "whatsapp" ? `https://wa.me/${hit.value.replace(/\D/g, "")}` : undefined);
      return (
        <a key={channel} className={channel === "whatsapp" ? "tk-btn tk-btn-whatsapp" : "tk-btn tk-btn-rose"} data-tk={tk} href={href}>
          {hit.value}
        </a>
      );
    }
    return (
      <button key={channel} type="button" className={channel === "whatsapp" ? "tk-btn tk-btn-whatsapp" : "tk-btn tk-btn-rose"} data-tk={tk} onClick={() => open(channel)} disabled={busy === channel}>
        {channel === "phone" ? <Phone size={16} /> : channel === "whatsapp" ? <Wa /> : null}
        {busy === channel ? "…" : label}
      </button>
    );
  });
  if (sticky) {
    return (
      <>
        {buttons}
        {message ? <p className="t-caption" style={{ gridColumn: "1 / -1" }}>{message}</p> : null}
      </>
    );
  }
  return (
    <div className="tk-actions">
      {buttons}
      {message ? <p className="t-caption">{message}</p> : null}
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
