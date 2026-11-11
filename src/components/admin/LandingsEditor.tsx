"use client";

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { saveFreeAdsForAdmin, saveLandingForAdmin } from "@/app/admin/growth-actions";

type Faq = { q: string; a: string };
type Landing = { key: string; h1: string; intro: string; faqs: Faq[] };

function blankFaq(): Faq {
  return { q: "", a: "" };
}

function withFaqRow(landing: Landing): Landing {
  return landing.faqs.length ? landing : { ...landing, faqs: [blankFaq()] };
}

export function LandingsEditor({ landings, freeAds }: { landings: Landing[]; freeAds: number }) {
  const [message, setMessage] = useState("");
  const [current, setCurrent] = useState<Landing>(withFaqRow(landings[0] || { key: "", h1: "", intro: "", faqs: [] }));
  const [limit, setLimit] = useState(String(freeAds));

  function load(key: string) {
    setCurrent(withFaqRow(landings.find((item) => item.key === key) || { key, h1: "", intro: "", faqs: [] }));
  }

  function setFaq(index: number, patch: Partial<Faq>) {
    setCurrent({
      ...current,
      faqs: current.faqs.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    });
  }

  return (
    <AdminShell title="Landing pages">
      <p className="mb-4 t-small text-muted">Edit a saved city page or add a key like dating|gurgaon. The form opens with the copy already stored.</p>
      <form
        className="grid max-w-xl gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const result = await saveLandingForAdmin(current);
          setMessage(result.ok ? `Saved ${result.faqs.length} FAQ${result.faqs.length === 1 ? "" : "s"}` : result.message);
        }}
      >
        {landings.length ? (
          <select value={landings.some((item) => item.key === current.key) ? current.key : ""} onChange={(event) => load(event.target.value)} className="rounded border px-3 py-2">
            <option value="">New landing</option>
            {landings.map((item) => (
              <option key={item.key} value={item.key}>{item.key}</option>
            ))}
          </select>
        ) : null}
        <input name="key" required placeholder="dating|gurgaon" value={current.key} onChange={(event) => setCurrent({ ...current, key: event.target.value })} className="rounded border px-3 py-2" />
        <input name="h1" required placeholder="Dating in Gurgaon" value={current.h1} onChange={(event) => setCurrent({ ...current, h1: event.target.value })} className="rounded border px-3 py-2" />
        <textarea name="intro" required rows={4} placeholder="Intro shown under the listings" value={current.intro} onChange={(event) => setCurrent({ ...current, intro: event.target.value })} className="rounded border px-3 py-2" />
        {current.faqs.map((faq, index) => (
          <div key={index} className="grid gap-2 rounded border border-line p-3" data-tk="faq-row">
            <input name={`question-${index}`} placeholder={`FAQ question ${index + 1}`} value={faq.q} onChange={(event) => setFaq(index, { q: event.target.value })} className="rounded border px-3 py-2" />
            <textarea name={`answer-${index}`} rows={3} placeholder="FAQ answer" value={faq.a} onChange={(event) => setFaq(index, { a: event.target.value })} className="rounded border px-3 py-2" />
            {current.faqs.length > 1 ? (
              <button
                type="button"
                className="tk-btn w-fit"
                onClick={() => setCurrent({ ...current, faqs: current.faqs.filter((_, i) => i !== index) })}
              >
                Remove FAQ
              </button>
            ) : null}
          </div>
        ))}
        <button type="button" className="tk-btn w-fit" onClick={() => setCurrent({ ...current, faqs: [...current.faqs, blankFaq()] })}>
          Add FAQ
        </button>
        <button type="submit" className="tk-btn tk-btn-primary w-fit">Save landing</button>
      </form>
      <form
        className="mt-8 grid max-w-xs gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const result = await saveFreeAdsForAdmin(Number(limit));
          setMessage(result.ok ? `Free ads per week: ${result.freeAdsPerWeek}` : result.message);
        }}
      >
        <label className="t-small">Free ads each account can publish per week</label>
        <input name="count" type="number" min={0} max={50} value={limit} onChange={(event) => setLimit(event.target.value)} className="rounded border px-3 py-2" />
        <button type="submit" className="tk-btn tk-btn-primary w-fit">Save limit</button>
      </form>
      {message ? <p className="mt-3">{message}</p> : null}
    </AdminShell>
  );
}
