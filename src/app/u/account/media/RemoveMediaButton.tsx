"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeMyMediaAction } from "@/components/post/mediaActions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/** Removes one photo or video from its ad, after the owner confirms. A live ad's cover is refused by the server. */
export function RemoveMediaButton({ id, kind }: { id: string; kind: "image" | "video" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const noun = kind === "video" ? "video" : "photo";

  async function remove() {
    setBusy(true);
    setError("");
    const res = await removeMyMediaAction(id);
    setBusy(false);
    setAsking(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 4, justifyItems: "start" }}>
      <button type="button" className="tk-btn tk-btn-outline-primary" data-tk="media-remove" disabled={busy} onClick={() => setAsking(true)}>
        {busy ? "Removing…" : "Remove"}
      </button>
      {error ? <span role="alert" className="t-caption" data-tk="media-error" style={{ color: "var(--danger)" }}>{error}</span> : null}
      <ConfirmDialog
        open={asking}
        title={`Remove this ${noun}?`}
        text={`It is taken off its ad and the file is deleted. This cannot be undone.`}
        confirmLabel="Remove"
        tone="danger"
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => setAsking(false)}
      />
    </div>
  );
}
