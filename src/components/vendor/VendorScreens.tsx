"use client";

import Link from "next/link";
import { VendorShell, Tile } from "./VendorShell";
import { useState } from "react";

export function Dashboard({ locked = false }: { locked?: boolean }) {
  return (
    <VendorShell title={locked ? "Dashboard — verification required" : "Dashboard"} verified={!locked}>
      {locked ? (
        <div className="mb-4 border border-[#e20044] bg-[#fff5f7] p-4 text-[13px]">
          <p className="font-bold text-[#e20044]">Verify your ID to post and manage ads.</p>
          <ol className="mt-2 list-decimal pl-5">
            <li>Document</li>
            <li>Face scan</li>
            <li>Final check</li>
          </ol>
          <Link href="/u/account/kyc/" className="btn-post mt-3 inline-block">
            Start / Try again
          </Link>
        </div>
      ) : null}
      <p className="mb-4 text-[13px]">Welcome back</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Tile title="Ads" href="/u/account/ads/">
          Active 12 · Not published 2
        </Tile>
        <Tile title="Wallet" href="/u/account/credits/">
          Current 1,200 · Used 340 · Buy credits
        </Tile>
        <Tile title="Coupons" href="/u/account/coupons/">
          WELCOME50
        </Tile>
        <Tile title="Settings" href="/u/account/edit-account/">
          Email, phone, password
        </Tile>
        <Tile title="Media" href="/u/account/media/">
          Albums and placeholders
        </Tile>
        <Tile title="Analytics" href="/u/account/analytics/">
          Health score 72
        </Tile>
        <Tile title="Subscription" href="/u/account/subscription/">
          Launch price
        </Tile>
        <Tile title="Notifications" href="/u/account/notifications/">
          3 unread
        </Tile>
      </div>
      <p className="mt-4 text-[12px]">
        <Link href="/u/account/dashboard/?locked=1">View locked dashboard</Link>
      </p>
    </VendorShell>
  );
}

export function AdsList() {
  const tabs = ["Published", "Not published", "Pending", "Drafts", "Duplicated"];
  const [tab, setTab] = useState("Published");
  return (
    <VendorShell title="Ads">
      <div className="mb-3 flex flex-wrap gap-1">
        {tabs.map((t) => (
          <button key={t} type="button" className={`px-3 py-1 text-[13px] ${tab === t ? "bg-[var(--sk-blue)] text-white" : "bg-white"}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="bg-white">
        {[1, 2, 3].map((n) => (
          <article key={n} className="flex gap-3 border-b p-3 text-[13px]">
            <img src={`/placeholders/p${n}.jpg`} alt="" className="h-16 w-12 object-cover" />
            <div>
              <Link href="/u/account/ads/in00001/" className="font-bold">
                Demo ad {n} · Hyderabad · {tab}
              </Link>
              <p className="text-[#777]">Expires 12 Nov · Top · Auto-renew on</p>
              <p className="mt-1 flex flex-wrap gap-2">
                <Link href="/u/account/ads/in00001/edit/">Edit</Link>
                <Link href="/u/post-insert/">Promote</Link>
                <button type="button">Suspend</button>
                <button type="button" onClick={() => confirm("Delete is permanent. Active promotion is not refunded.")}>
                  Delete
                </button>
                <button type="button">Share</button>
                <Link href="/u/account/ads/in00001/?dup=1">Duplicate</Link>
              </p>
            </div>
          </article>
        ))}
      </div>
    </VendorShell>
  );
}

export function Simple({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <VendorShell title={title}>
      <div className="panel text-[14px] leading-6">{children}</div>
    </VendorShell>
  );
}
