"use client";

import { useState } from "react";
import Link from "next/link";
import { api, friendlyError } from "@/lib/ui/api";

type Action = "pause" | "resume" | "renew" | "duplicate" | "delete";

/**
 * H7.5: the owner buttons under an ad in the vendor panel. Which ones show depends on the ad's status:
 * live ads can be paused (and renewed when they end soon), paused ads resume, ended ads are posted again.
 */
export function OwnerActions({
  id,
  status,
  endsSoon,
  onDone,
}: {
  id: string;
  status?: string;
  endsSoon: boolean;
  onDone: (message: string) => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const actions: Action[] = [];
  if (status === "active") actions.push("pause");
  if (status === "paused") actions.push("resume");
  if (status === "active" && endsSoon) actions.push("renew");
  if (status === "expired" || status === "archived") actions.push("duplicate");
  actions.push("delete");

  async function run(action: Action) {
    if (action === "delete" && !window.confirm("Delete this ad?")) return;
    setBusy(true);
    const res = action === "delete"
      ? await api(`/api/listings/${id}`, { method: "DELETE" })
      : await api(`/api/listings/${id}/${action}`, { method: "POST", body: "{}" });
    setBusy(false);
    await onDone(res.ok ? LABEL_DONE[action] : friendlyError(res.error));
  }

  return (
    <div className="tkv-owner-buttons">
      <Link href={`/u/post-insert/?draft=${id}&step=2`} className="tkv-mini">Edit</Link>
      {actions.map((action) => (
        <button key={action} type="button" className={`tkv-mini ${action === "delete" ? "tkv-mini-quiet" : "tkv-mini-strong"}`} disabled={busy} onClick={() => run(action)}>
          {LABEL[action]}
        </button>
      ))}
    </div>
  );
}

const LABEL: Record<Action, string> = {
  pause: "Pause",
  resume: "Resume",
  renew: "Renew",
  duplicate: "Post again",
  delete: "Delete",
};

const LABEL_DONE: Record<Action, string> = {
  pause: "Paused.",
  resume: "Live again.",
  renew: "Renewed for another run.",
  duplicate: "Copied as a new draft. Find it under All.",
  delete: "Deleted.",
};
