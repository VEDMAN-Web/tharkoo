"use client";

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { saveFreeAdsForAdmin, saveLandingForAdmin } from "../growth-actions";

export default function LandingsAdminPage() {
  const [message, setMessage] = useState("");
  return (
    <AdminShell title="Landing pages">
      <p className="mb-4 t-small text-muted">Set the intro and one FAQ for a city or district page. The key is category|city, for example dating|gurgaon.</p>
      <form
        className="grid max-w-xl gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const result = await saveLandingForAdmin({
            key: String(form.get("key") || ""),
            h1: String(form.get("h1") || ""),
            intro: String(form.get("intro") || ""),
            question: String(form.get("question") || ""),
            answer: String(form.get("answer") || ""),
          });
          setMessage(result.ok ? "Saved" : result.message);
        }}
      >
        <input name="key" required placeholder="dating|gurgaon" className="rounded border px-3 py-2" />
        <input name="h1" required placeholder="Dating in Gurgaon" className="rounded border px-3 py-2" />
        <textarea name="intro" required rows={4} placeholder="Intro shown under the listings" className="rounded border px-3 py-2" />
        <input name="question" placeholder="FAQ question" className="rounded border px-3 py-2" />
        <textarea name="answer" rows={3} placeholder="FAQ answer" className="rounded border px-3 py-2" />
        <button type="submit" className="tk-btn tk-btn-primary w-fit">Save landing</button>
      </form>
      <form
        className="mt-8 grid max-w-xs gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const result = await saveFreeAdsForAdmin(Number(form.get("count")));
          setMessage(result.ok ? `Free ads per week: ${result.freeAdsPerWeek}` : result.message);
        }}
      >
        <label className="t-small">Free ads each account can publish per week</label>
        <input name="count" type="number" min={0} max={50} defaultValue={3} className="rounded border px-3 py-2" />
        <button type="submit" className="tk-btn tk-btn-primary w-fit">Save limit</button>
      </form>
      {message ? <p className="mt-3">{message}</p> : null}
    </AdminShell>
  );
}
