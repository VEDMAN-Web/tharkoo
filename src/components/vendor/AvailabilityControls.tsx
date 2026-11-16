"use client";

import { useEffect, useRef, useState } from "react";
import { api, friendlyError, hasSessionHint } from "@/lib/ui/api";
import type { PresenceStatus } from "@/server/availability/status";

type Presence = { available: boolean; status: PresenceStatus; callsAllowed: boolean; awayAfterHours: number; liveChat: boolean };

const ACTIVITY_GAP_MS = 5 * 60 * 1000;

export function usePresenceActivity() {
  const lastPing = useRef(0);
  useEffect(() => {
    if (!hasSessionHint()) return;
    function ping() {
      const now = Date.now();
      if (now - lastPing.current < ACTIVITY_GAP_MS) return;
      lastPing.current = now;
      void api("/api/availability/activity", { method: "POST", body: "{}" });
    }
    window.addEventListener("pointerdown", ping);
    window.addEventListener("keydown", ping);
    return () => {
      window.removeEventListener("pointerdown", ping);
      window.removeEventListener("keydown", ping);
    };
  }, []);
}

export function AvailabilityControls() {
  const [presence, setPresence] = useState<Presence | null>(null);
  const [note, setNote] = useState("");
  usePresenceActivity();

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!hasSessionHint()) return;
      api<Presence>("/api/availability").then((res) => {
        if (res.ok) setPresence(res.data);
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  async function toggleAvailable() {
    if (!presence) return;
    const res = await api<Presence>("/api/availability", { method: "PATCH", body: JSON.stringify({ available: !presence.available }) });
    if (res.ok) {
      setPresence(res.data);
      setNote(res.data.available ? "People see Online now. They can call or chat." : "People see Away. Calls are paused. Chat still works.");
    } else setNote(friendlyError(res.error));
  }

  async function toggleLiveChat() {
    if (!presence) return;
    const res = await api<Presence>("/api/availability/live-chat", { method: "PATCH", body: JSON.stringify({ liveChat: !presence.liveChat }) });
    if (res.ok) {
      setPresence(res.data);
      setNote(res.data.liveChat ? "Live chat is on. Your ads show Online now or Away, and a Chat online now button." : "Live chat is off. Your ads have no badge and no chat button.");
    } else setNote(friendlyError(res.error));
  }

  if (!presence) return null;
  return (
    <section className="up-glass up-panel" aria-label="Availability" data-tk="availability">
      <div className="tkv-hero-actions">
        <button type="button" className={`tkv-avail ${presence.available ? "is-on" : ""}`} aria-pressed={presence.available} onClick={toggleAvailable}>
          <span className="tkv-avail-text">
            <span className="tkv-avail-title">Available now</span>
            <span className="tkv-avail-help">
              {presence.available
                ? presence.status === "online"
                  ? "People see Online now and can call or chat."
                  : "Away (auto): no activity for a while. Any action brings you back online."
                : "Away: you switched it off. Turn it on to show Online now."}
            </span>
          </span>
          <span className="tkv-switch" aria-hidden><i /></span>
        </button>
        <button type="button" className={`tkv-avail ${presence.liveChat ? "is-on" : ""}`} aria-pressed={presence.liveChat} onClick={toggleLiveChat}>
          <span className="tkv-avail-text">
            <span className="tkv-avail-title">Live chat</span>
            <span className="tkv-avail-help">{presence.liveChat ? "On: your ads show Online now or Away, and a chat button." : "Off: no badge and no chat button on your ads."}</span>
          </span>
          <span className="tkv-switch" aria-hidden><i /></span>
        </button>
      </div>
      <p className="tkv-note" aria-live="polite">{note}</p>
    </section>
  );
}
