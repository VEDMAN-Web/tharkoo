"use client";

import { useEffect, useMemo, useState } from "react";
import { Ticket } from "lucide-react";
import { api, friendlyError, hasSessionHint } from "@/lib/ui/api";
import { VendorShell } from "../vendor/VendorShell";
import { EmptyState } from "../ui/EmptyState";
import { HelpCard } from "../ui/HelpCard";

export function WalletHistory() {
  const [items, setItems] = useState<{ id: string; delta: number; reason: string; createdAt: string | null }[] | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!hasSessionHint()) {
        setSignedOut(true);
        return;
      }
      api<{ items: { id: string; delta: number; reason: string; createdAt: string | null }[] }>("/api/wallet/entries").then((res) => {
        if (!res.ok) setSignedOut(true);
        else setItems(res.data.items || []);
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <VendorShell>
      <h1 className="tk-page-h1">Transaction History</h1>
      {signedOut ? (
        <EmptyState title="Sign in to see history" body="Transactions appear after you log in." action={{ href: "/u/login/?next=/u/account/credits/history/", label: "Log in" }} />
      ) : items && items.length === 0 ? (
        <EmptyState title="No transactions yet" body="Purchases and spends will show up here." action={{ href: "/u/account/credits/", label: "Open wallet" }} />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="w-full text-left t-small">
            <thead>
              <tr><th>When</th><th>Reason</th><th>Credits</th></tr>
            </thead>
            <tbody>
              {(items || []).map((row) => (
                <tr key={row.id}>
                  <td>{row.createdAt ? new Date(row.createdAt).toLocaleDateString("en-IN") : ""}</td>
                  <td>{row.reason}</td>
                  <td>{row.delta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <HelpCard />
    </VendorShell>
  );
}

export function CouponRedeem() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState("");
  async function redeem(event: React.FormEvent) {
    event.preventDefault();
    const res = await api("/api/coupons/redeem", { method: "POST", body: JSON.stringify({ code }) });
    setMessage(res.ok ? "Coupon applied." : friendlyError(res.error));
  }
  const faqs = useMemo(
    () => [
      ["How to use a coupon?", "Use the coupon box on this page or on the Buy Credits page."],
      ["Where do I see my coupons?", "Coupon credit appears in the wallet history."],
    ],
    [],
  );
  return (
    <VendorShell>
      <h1 className="tk-page-h1">Coupons</h1>
      <form onSubmit={redeem}>
        <p className="t-small"><Ticket size={14} /> Do you have a Coupon?</p>
        <div style={{ display: "flex", gap: 8 }}>
          <input aria-label="Insert coupon code" placeholder="Insert coupon code" value={code} onChange={(event) => setCode(event.target.value)} style={{ flex: 1, height: 32, border: "1px solid var(--border)", borderRadius: 4, padding: "0 8px" }} />
          <button type="submit" className="tk-btn tk-btn-outline-primary" data-tk="apply-coupon">APPLY</button>
        </div>
        <p aria-live="polite" className="t-small">{message}</p>
      </form>
      <p style={{ textAlign: "center", marginTop: 50, color: "var(--muted)" }}>Frequently asked questions</p>
      {faqs.map(([q, a]) => (
        <div key={q}>
          <button type="button" className="tk-acc" aria-expanded={open === q} onClick={() => setOpen(open === q ? "" : q)}>
            {q} <span>{open === q ? "▴" : "▾"}</span>
          </button>
          {open === q ? <p className="t-small">{a}</p> : null}
        </div>
      ))}
      <HelpCard />
    </VendorShell>
  );
}

async function storeId(file: File) {
  const signed = await api<{ uploadUrl: string; mediaId: string; apiKey?: string; timestamp?: number; signature?: string; folder?: string; params?: Record<string, string | number> }>("/api/media/sign", {
    method: "POST",
    body: JSON.stringify({ contentType: file.type, byteSize: file.size, kind: "id_document" }),
  });
  if (!signed.ok) return signed;
  if (signed.data.uploadUrl.startsWith("/")) {
    const body = new FormData();
    body.set("file", file);
    body.set("mediaId", signed.data.mediaId);
    const saved = await fetch(signed.data.uploadUrl, { method: "POST", body, credentials: "same-origin" });
    if (!saved.ok) return { ok: false as const, error: { message: "That photo could not be saved." }, status: saved.status };
  } else {
    const body = new FormData();
    body.set("file", file);
    body.set("api_key", signed.data.apiKey || "");
    body.set("timestamp", String(signed.data.timestamp || ""));
    body.set("signature", signed.data.signature || "");
    body.set("folder", signed.data.folder || "");
    for (const [key, value] of Object.entries(signed.data.params || {})) body.set(key, String(value));
    const saved = await fetch(signed.data.uploadUrl, { method: "POST", body });
    if (!saved.ok) return { ok: false as const, error: { message: "That photo could not be saved." }, status: saved.status };
    const done = await api("/api/media/complete", { method: "POST", body: JSON.stringify({ mediaId: signed.data.mediaId }) });
    if (!done.ok) return done;
  }
  return { ok: true as const, data: { mediaId: signed.data.mediaId }, status: 200 };
}

export function KycStatus() {
  const [status, setStatus] = useState("");
  const [signedOut, setSignedOut] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!hasSessionHint()) {
        setSignedOut(true);
        return;
      }
      api<{ status?: string }>("/api/verification/status").then((res) => {
        if (!res.ok) setSignedOut(true);
        else setStatus(res.data.status || "On file");
      });
    }, 0);
    return () => window.clearTimeout(id);
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
    setMessage("Sent for review. An admin will approve it before you can publish.");
  }

  return (
    <VendorShell>
      <h1 className="tk-page-h1">Identity check</h1>
      {signedOut ? (
        <EmptyState title="Sign in to check your status" body="Verification status is available after you log in." action={{ href: "/u/login/?next=/u/account/kyc/", label: "Log in" }} />
      ) : (
        <>
          <p className="t-body">Current status: {status || "Loading…"}</p>
          {status !== "approved" ? (
            <form onSubmit={submit} className="grid gap-3" style={{ maxWidth: 420, marginTop: 16 }}>
              <label className="t-small">ID photo<input id="front-id" name="front" type="file" accept="image/jpeg,image/png,image/webp" required /></label>
              <label className="t-small">Photo of you<input id="selfie-id" name="selfie" type="file" accept="image/jpeg,image/png,image/webp" required /></label>
              <button type="submit" className="tk-btn tk-btn-cta" data-tk="kyc-submit" disabled={busy}>{busy ? "Sending…" : "Submit for review"}</button>
            </form>
          ) : null}
          {message ? <p data-tk="kyc-note">{message}</p> : null}
        </>
      )}
      <HelpCard />
    </VendorShell>
  );
}

export function ComingSoon({ title, body, href, label }: { title: string; body: string; href: string; label: string }) {
  return (
    <VendorShell>
      <h1 className="tk-page-h1">{title}</h1>
      <EmptyState title="Coming soon" body={body} action={{ href, label }} />
      <HelpCard />
    </VendorShell>
  );
}
