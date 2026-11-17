"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Lock, Undo2 } from "lucide-react";
import { ToastProvider, useToast } from "@/components/admin/ui";
import { undoAction } from "@/app/admin/undo-actions";
import type { RecentChange } from "@/server/admin/dashboard";

function ago(iso: string, now: number) {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${minutes % 60} min ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

function Rows({ items, now }: { items: RecentChange[]; now: number }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState("");

  async function undo(item: RecentChange) {
    setBusy(item.id);
    const outcome = await undoAction(item.id);
    setBusy("");
    if (outcome.ok) {
      toast.show({ kind: "success", message: "Undone." });
      router.refresh();
    } else {
      toast.show({ kind: "error", message: outcome.message });
    }
  }

  return (
    <ul className="adm-d-list" data-tk="recent-changes">
      {items.map((item) => (
        <li key={item.id} className="adm-d-row" data-tk="recent-row">
          <span className="adm-d-text">
            <strong>{item.who} {item.summary.charAt(0).toLowerCase()}{item.summary.slice(1)}</strong>
            <small>{item.label ? `${item.label} · ` : ""}{ago(item.at, now)}</small>
          </span>
          {item.undoable ? (
            <button type="button" className="adm-d-open" data-tk="recent-undo" disabled={busy === item.id} onClick={() => void undo(item)}>
              <Undo2 size={14} aria-hidden="true" focusable="false" /> Undo
            </button>
          ) : item.lock ? (
            <span className="adm-d-lock"><Lock size={14} aria-hidden="true" focusable="false" /> Cannot undo</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function RecentCard({ items, now }: { items: RecentChange[]; now: number }) {
  return (
    <section className="adm-card adm-d-card" aria-labelledby="dash-recent" data-tk="recent">
      <header className="adm-d-head">
        <h2 id="dash-recent">Recent changes</h2>
        <Link href="/admin/history/" className="adm-d-link">All history</Link>
      </header>
      {items.length === 0 ? (
        <p className="adm-d-empty">No staff changes have been recorded yet.</p>
      ) : (
        <ToastProvider>
          <Rows items={items} now={now} />
        </ToastProvider>
      )}
    </section>
  );
}
