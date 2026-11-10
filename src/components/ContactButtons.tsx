"use client";

import { useState } from "react";
import { api, friendlyError } from "@/lib/ui/api";

type Channel = "phone" | "whatsapp" | "telegram";

async function reveal(slug: string | undefined, id: string | undefined, channel: Channel) {
  let listingId = id;
  if (!listingId && slug) {
    const pub = await api<{ id: string }>(`/api/listings/${encodeURIComponent(slug)}`);
    if (!pub.ok) return { error: friendlyError(pub.error) };
    listingId = pub.data.id;
  }
  if (!listingId) return { error: "Contact is unavailable right now." };
  const res = await api<{ value?: string | null; deepLink?: string | null }>(`/api/listings/${listingId}/contact-reveal`, {
    method: "POST",
    body: JSON.stringify({ channel }),
  });
  if (!res.ok) return { error: friendlyError(res.error) };
  if (!res.data.value && !res.data.deepLink) return { error: "This poster has not shared that channel." };
  return { value: res.data.value || "", href: res.data.deepLink || undefined };
}

export function ContactButtons({
  phone,
  whatsapp,
  telegram,
  compact,
  sticky,
  listingSlug,
  listingId,
  revealOnly,
}: {
  phone?: string | null;
  whatsapp?: string | null;
  telegram?: string | null;
  compact?: boolean;
  sticky?: boolean;
  listingSlug?: string;
  listingId?: string;
  revealOnly?: boolean;
}) {
  const [busy, setBusy] = useState<Channel | null>(null);
  const [shown, setShown] = useState<Partial<Record<Channel, string>>>({});
  const [hrefs, setHrefs] = useState<Partial<Record<Channel, string>>>({});
  const [message, setMessage] = useState("");

  async function open(channel: Channel) {
    setBusy(channel);
    setMessage("");
    const result = await reveal(listingSlug, listingId, channel);
    setBusy(null);
    if ("error" in result && result.error) {
      const legacy = channel === "phone" ? phone : channel === "whatsapp" ? whatsapp : telegram;
      if (legacy) setShown((prev) => ({ ...prev, [channel]: legacy }));
      else setMessage(result.error);
      return;
    }
    if ("value" in result) {
      setShown((prev) => ({ ...prev, [channel]: result.value }));
      if (result.href) setHrefs((prev) => ({ ...prev, [channel]: result.href }));
    }
  }

  if (revealOnly || compact) {
    return (
      <div className="min-w-0">
        <button type="button" className="gold-btn w-full" onClick={() => open("phone")} disabled={busy === "phone"}>
          {busy === "phone" ? "Please wait" : "Reveal contact"}
        </button>
        {shown.phone ? <p className="t-small mt-1 break-all">{shown.phone}</p> : null}
        {message ? <p className="t-caption mt-1 text-muted">{message}</p> : null}
      </div>
    );
  }

  const channels: { id: Channel; label: string; on: boolean }[] = [
    { id: "phone", label: "Call", on: true },
    { id: "whatsapp", label: "WhatsApp", on: true },
    { id: "telegram", label: "Telegram", on: !sticky },
  ];
  const buttons = channels
    .filter((channel) => channel.on)
    .map((channel) =>
      shown[channel.id] ? (
        <a
          key={channel.id}
          className="gold-btn min-w-0"
          href={hrefs[channel.id] || (channel.id === "phone" ? `tel:${shown[channel.id]}` : undefined)}
        >
          <span className="truncate">{channel.id === "phone" ? "Call" : channel.label}</span>
        </a>
      ) : (
        <button key={channel.id} type="button" className="gold-btn min-w-0" onClick={() => open(channel.id)} disabled={busy === channel.id}>
          {busy === channel.id ? "…" : channel.label}
        </button>
      ),
    );

  if (sticky) {
    return (
      <>
        {buttons}
        {message ? <p className="t-caption col-span-full text-muted">{message}</p> : null}
      </>
    );
  }

  return (
    <div className="grid min-w-0 gap-2 sm:grid-cols-3">
      {buttons}
      {message ? <p className="t-caption text-muted">{message}</p> : null}
    </div>
  );
}
