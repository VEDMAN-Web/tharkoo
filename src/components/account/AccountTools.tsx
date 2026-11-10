"use client";

import { useEffect, useState } from "react";
import { api, friendlyError, idempotencyKey } from "@/lib/ui/api";
import { Button } from "../ui/Button";
import { Field, Input } from "../ui/Input";
import { VendorShell } from "../vendor/VendorShell";
import { EmptyState } from "../ui/EmptyState";

export function WalletPanel({ packs }: { packs: { id: string; credits: number; price: number; bonus?: number }[] }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    api<{ balance: number }>("/api/wallet").then((res) => {
      if (!res.ok) setSignedOut(true);
      else setBalance(res.data.balance);
    });
  }, []);

  async function buy(packId: string) {
    setMessage("");
    const res = await api<{ balance: number }>("/api/wallet/packs", {
      method: "POST",
      body: JSON.stringify({ packId, idempotencyKey: idempotencyKey(packId) }),
    });
    if (!res.ok) return setMessage(friendlyError(res.error));
    setBalance(res.data.balance);
    setMessage("Credits added.");
  }

  return (
    <VendorShell title="Wallet">
      {signedOut ? (
        <EmptyState title="Sign in to see your wallet" body="Your credit balance loads after you log in." action={{ href: "/u/login/?next=/u/account/credits/", label: "Log in" }} />
      ) : (
        <>
          <p className="t-body">Balance: {balance === null ? "…" : balance} credits</p>
          <p aria-live="polite" className="t-small text-gold">{message}</p>
          <div className="mt-4 grid gap-3">
            {packs.map((pack) => (
              <div key={pack.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-4">
                <p className="t-small">
                  {pack.credits} credits{pack.bonus ? ` + ${pack.bonus} extra` : ""} · {pack.price}
                </p>
                <Button type="button" onClick={() => buy(pack.id)}>
                  Buy
                </Button>
              </div>
            ))}
            {!packs.length ? <p className="t-small text-muted">No credit packs are on sale right now.</p> : null}
          </div>
        </>
      )}
    </VendorShell>
  );
}

export function WalletHistory() {
  const [items, setItems] = useState<{ id: string; delta: number; reason: string; createdAt: string | null }[] | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  useEffect(() => {
    api<{ items: { id: string; delta: number; reason: string; createdAt: string | null }[] }>("/api/wallet/entries").then((res) => {
      if (!res.ok) setSignedOut(true);
      else setItems(res.data.items || []);
    });
  }, []);
  return (
    <VendorShell title="Credit history">
      {signedOut ? (
        <EmptyState title="Sign in to see history" body="Transactions appear after you log in." action={{ href: "/u/login/?next=/u/account/credits/history/", label: "Log in" }} />
      ) : items && items.length === 0 ? (
        <EmptyState title="No transactions yet" body="Purchases and spends will show up here." action={{ href: "/u/account/credits/", label: "Open wallet" }} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] text-left t-small">
            <thead>
              <tr>
                <th>When</th>
                <th>Reason</th>
                <th>Credits</th>
              </tr>
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
          {items === null ? <p className="t-small text-muted">Loading…</p> : null}
        </div>
      )}
    </VendorShell>
  );
}

export function CouponRedeem() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  async function redeem(event: React.FormEvent) {
    event.preventDefault();
    const res = await api("/api/coupons/redeem", { method: "POST", body: JSON.stringify({ code }) });
    setMessage(res.ok ? "Coupon applied." : friendlyError(res.error));
  }
  return (
    <VendorShell title="Coupons">
      <form onSubmit={redeem} className="grid max-w-md gap-3">
        <Field id="code" label="Coupon code">
          <Input id="code" value={code} onChange={(event) => setCode(event.target.value)} />
        </Field>
        <Button type="submit">Apply</Button>
        <p aria-live="polite" className="t-small text-gold">{message}</p>
      </form>
    </VendorShell>
  );
}

export function KycStatus() {
  const [status, setStatus] = useState("");
  const [signedOut, setSignedOut] = useState(false);
  useEffect(() => {
    api<{ status?: string }>("/api/verification/status").then((res) => {
      if (!res.ok) setSignedOut(true);
      else setStatus(res.data.status || "On file");
    });
  }, []);
  return (
    <VendorShell title="Identity check">
      {signedOut ? (
        <EmptyState title="Sign in to check your status" body="Verification status is available after you log in." action={{ href: "/u/login/?next=/u/account/kyc/", label: "Log in" }} />
      ) : (
        <>
          <p className="t-body text-muted">Current status: {status || "Loading…"}</p>
          <p className="mt-3 t-small text-muted">Uploading an identity document from this page is coming soon.</p>
        </>
      )}
    </VendorShell>
  );
}

export function ComingSoon({ title, body, href, label }: { title: string; body: string; href: string; label: string }) {
  return (
    <VendorShell title={title}>
      <EmptyState title="Coming soon" body={body} action={{ href, label }} />
    </VendorShell>
  );
}
