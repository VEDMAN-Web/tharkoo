"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Clock3, ShieldAlert, ShieldQuestion } from "lucide-react";
import { api, friendlyError } from "@/lib/ui/api";
import { storeId } from "@/components/account/AccountTools";
import { UploadBox } from "./UploadBox";

type Look = { word: string; line: string; tone: "ok" | "wait" | "bad" | "none"; icon: typeof BadgeCheck };

const LOOKS: Record<string, Look> = {
  approved: { word: "ID checked", line: "Your identity is confirmed. You do not need to do anything.", tone: "ok", icon: BadgeCheck },
  pending_review: { word: "Being checked", line: "We are looking at your photos. This usually takes a short while.", tone: "wait", icon: Clock3 },
  rejected: { word: "Needs another look", line: "We could not confirm your ID from those photos. Send clear new ones.", tone: "bad", icon: ShieldAlert },
};
const NOT_YET: Look = { word: "Not checked yet", line: "Some categories ask for a quick ID check before an ad can go live.", tone: "none", icon: ShieldQuestion };

export function KycPanel() {
  const [status, setStatus] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ status?: string }>("/api/verification/status").then((res) => setStatus(res.ok ? res.data.status || "" : ""));
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const front = data.get("front");
    const selfie = data.get("selfie");
    if (!(front instanceof File) || !(selfie instanceof File) || !front.size || !selfie.size) {
      setMessage("Add a photo of your ID and a photo of yourself.");
      return;
    }
    setBusy(true);
    setMessage("");
    const frontSaved = await storeId(front);
    const selfieSaved = frontSaved.ok ? await storeId(selfie) : frontSaved;
    if (!frontSaved.ok || !selfieSaved.ok) {
      setBusy(false);
      setMessage(friendlyError(("error" in frontSaved && frontSaved.error) || ("error" in selfieSaved && selfieSaved.error) || {}));
      return;
    }
    const sent = await api("/api/verification/id/complete", {
      method: "POST",
      body: JSON.stringify({ frontAssetId: frontSaved.data.mediaId, selfieAssetId: selfieSaved.data.mediaId }),
    });
    setBusy(false);
    if (!sent.ok) {
      setMessage(friendlyError(sent.error));
      return;
    }
    setStatus("pending_review");
    setMessage("Sent for review. We will let you know when it is checked.");
  }

  const look = status === null ? null : LOOKS[status] ?? NOT_YET;
  const Icon = look?.icon;
  return (
    <section aria-labelledby="kyc-title" className="up-glass up-panel up-stack">
      <h1 id="kyc-title" className="up-h2">Identity check</h1>
      {look && Icon ? (
        <div className={`up-status up-status-${look.tone}`} data-tk="kyc-status" data-status={status || "none"}>
          <Icon size={28} aria-hidden="true" focusable="false" />
          <div>
            <p className="up-name">{look.word}</p>
            <p className="up-muted">{look.line}</p>
          </div>
        </div>
      ) : (
        <p className="up-muted">Loading...</p>
      )}
      {look && status !== "approved" && status !== "pending_review" ? (
        <form onSubmit={submit} className="up-form" data-tk="kyc-form">
          <UploadBox id="front-id" name="front" title="Add photo of your ID" hint="A clear photo of the front, all four corners visible" />
          <UploadBox id="selfie-id" name="selfie" title="Add a photo of you holding it" hint="Your face and the ID in the same photo" />
          <p className="up-muted">Your photos are only seen by our team and are never shown on your ads.</p>
          <button type="submit" className="up-btn" data-tk="kyc-submit" disabled={busy}>{busy ? "Sending..." : "Send for checking"}</button>
        </form>
      ) : null}
      {message ? <p className="up-note" role="status" data-tk="kyc-note">{message}</p> : null}
    </section>
  );
}
