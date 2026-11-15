"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeMyMediaAction } from "@/components/post/mediaActions";

/** Removes one photo or video from its ad, after the owner confirms. A live ad's cover is refused by the server. */
export function RemoveMediaButton({ id, kind }: { id: string; kind: "image" | "video" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const noun = kind === "video" ? "video" : "photo";

  async function remove() {
    if (!window.confirm(`Remove this ${noun} from its ad? The file is deleted.`)) return;
    setBusy(true);
    setError("");
    const res = await removeMyMediaAction(id);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 4, justifyItems: "start" }}>
      <button type="button" className="tk-btn tk-btn-outline-primary" data-tk="media-remove" disabled={busy} onClick={remove}>
        {busy ? "Removing…" : "Remove"}
      </button>
      {error ? <span role="alert" className="t-caption" data-tk="media-error" style={{ color: "var(--danger)" }}>{error}</span> : null}
    </div>
  );
}
