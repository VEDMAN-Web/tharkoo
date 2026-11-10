"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CATEGORIES, TAG_GROUPS, TOP_CITIES } from "@/data/catalog";
import { CREDIT_PACKS } from "@/lib/credit-packs";

const STEPS = ["Information", "Photos", "Promote"];

export function PostWizard() {
  const [step, setStep] = useState(1);
  const [screen, setScreen] = useState<"form" | "top" | "star" | "flash" | "upgrades" | "basket" | "billing" | "result" | "basic" | "limit" | "duplicate">("form");
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [banned, setBanned] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [picker, setPicker] = useState(false);
  const [pack, setPack] = useState(CREDIT_PACKS[3]);

  const previewTitle = useMemo(
    () => title || "9876500000 - Hyderabad Dating: Your nickname",
    [title],
  );

  if (screen === "result") {
    return (
      <Box title="Payment result">
        <p>Ad is live. Next bump is scheduled. Manage it from Ads.</p>
        <Link href="/u/account/ads/" className="btn-post mt-4 inline-block">Manage ad</Link>
      </Box>
    );
  }
  if (screen === "basic") {
    return (
      <Box title="Basic ad submitted">
        <p>Pending review. You have 2 free ads left this week. Promote for instant go-live.</p>
        <div className="mt-4 flex gap-2">
          <Link href="/u/account/ads/" className="btn-post">Ads (Pending)</Link>
          <button className="btn-ghost" type="button" onClick={() => { setScreen("form"); setStep(3); }}>Promote</button>
        </div>
      </Box>
    );
  }

  return (
    <div>
      <div className="stepper">
        {STEPS.map((s, i) => (
          <span key={s} className={step === i + 1 ? "on" : ""}>
            {i + 1}/3 {s}
          </span>
        ))}
      </div>

      {step === 1 && screen === "form" ? (
        <div className="panel grid gap-3">
          <h1 className="text-[22px]">Post your ad</h1>
          <label className="field">
            Phone
            <div className="flex gap-2">
              <input defaultValue="+91" className="w-16" />
              <input placeholder="Mobile number" className="flex-1" />
              <button type="button" className="btn-ghost" onClick={() => setPhoneOpen(true)}>Receive code now</button>
            </div>
            <button type="button" className="text-left text-[12px] underline" onClick={() => setPhoneOpen(true)}>Continue without phone number</button>
          </label>
          <label className="field">
            Category
            <select defaultValue="dating">
              {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </label>
          <label className="field">
            City
            <select defaultValue="Hyderabad">{TOP_CITIES.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <label className="field">District <input placeholder="Banjara Hills" /></label>
          <label className="field">Address <input /></label>
          <label className="field">Postal code <input /></label>
          <label className="field">Place <input placeholder="Near metro" /></label>
          <label className="field">Age <input type="number" defaultValue={24} /></label>
          <label className="field">Nickname (max 20) <input maxLength={20} /></label>
          <label className="field">
            Title (min 5)
            <input value={title} onChange={(e) => { setTitle(e.target.value); setBanned(e.target.value.toLowerCase().includes("advancefee") ? "advancefee" : ""); }} />
            {banned ? <span className="text-[12px] text-[#e20044]">Banned word: {banned}</span> : null}
          </label>
          <label className="field">
            Description
            <textarea rows={6} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </label>
          <label className="flex gap-2 text-[13px]"><input type="checkbox" /> AI-written text</label>
          {TAG_GROUPS.map((g) => (
            <label key={g.key} className="field">
              {g.label}
              {g.type === "select" ? (
                <select>{g.options.map((o) => <option key={o}>{o}</option>)}</select>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {g.options.map((o) => (
                    <label key={o} className="flex items-center gap-1 font-normal">
                      <input type="checkbox" /> {o}
                    </label>
                  ))}
                </div>
              )}
            </label>
          ))}
          <fieldset className="field">
            Contact method
            <label><input type="radio" name="cm" defaultChecked /> Phone</label>
            <label><input type="checkbox" defaultChecked /> WhatsApp</label>
            <label><input type="checkbox" /> Telegram</label>
            <label><input type="checkbox" /> Email</label>
          </fieldset>
          <label className="field">Price (optional) <input placeholder="₹" /></label>
          <label className="flex gap-2 text-[13px]"><input type="checkbox" defaultChecked /> I accept the Terms of use</label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-post" onClick={() => { if (title.length && title.length < 5) return; setStep(2); }}>Go on</button>
            <button type="button" className="btn-ghost" onClick={() => setScreen("duplicate")}>Duplicate text check</button>
            <button type="button" className="btn-ghost" onClick={() => setScreen("limit")}>Weekly limit</button>
          </div>
        </div>
      ) : null}

      {step === 2 && screen === "form" ? (
        <div className="panel">
          <h1 className="text-[22px]">Photos</h1>
          <p className="mt-1 text-[13px] text-[#555]">Free ads show 1 photo. Promoted ads show more. Use clothed placeholders only.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {photos.map((p) => (
              <img key={p} src={p} alt="" className="h-24 w-20 object-cover" />
            ))}
            <label className="grid h-24 w-32 place-items-center border border-dashed text-[12px]">
              Drop zone / file picker
              <input type="file" className="hidden" multiple onChange={() => setPhotos(["/placeholders/p1.jpg", "/placeholders/p2.jpg"])} />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={() => setPicker(true)}>Choose from media library</button>
            <button type="button" className="btn-post" onClick={() => setStep(3)}>Save and continue</button>
            <button type="button" className="btn-ghost" onClick={() => setStep(3)}>Continue without photo</button>
            <button type="button" className="btn-ghost">Save as draft</button>
          </div>
        </div>
      ) : null}

      {step === 3 && screen === "form" ? (
        <div className="panel">
          <h1 className="text-[22px]">Promote or publish</h1>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="border p-3">
              <p className="font-bold">Desktop / mobile preview</p>
              <p className="mt-2 text-[13px] font-bold">{previewTitle}</p>
              <img src={photos[0] || "/placeholders/p1.jpg"} alt="" className="mt-2 h-28 w-full object-cover" />
            </div>
            <div className="grid gap-2">
              <button type="button" className="border p-3 text-left" onClick={() => setScreen("top")}>
                <strong>Top</strong>
                <p className="text-[12px]">Bumps + TOP badge. Learn how it works.</p>
              </button>
              <button type="button" className="border p-3 text-left" onClick={() => setScreen("flash")}>
                <strong>Flash</strong>
                <p className="text-[12px]">4 hours, Available now, Super Top look.</p>
              </button>
              <button type="button" className="border p-3 text-left" onClick={() => setScreen("star")}>
                <strong>Star</strong>
                <p className="text-[12px]">Homepage-city strip. 6 slots per window.</p>
              </button>
              <button type="button" className="btn-ghost" onClick={() => setScreen("basic")}>Advertise for free (2 free ads left this week)</button>
              <button type="button" className="btn-ghost">Save as draft</button>
            </div>
          </div>
        </div>
      ) : null}

      {screen === "top" ? (
        <div className="panel grid gap-3">
          <h1 className="text-[22px]">Top configuration</h1>
          <label className="field">Duration <select><option>1 day</option><option>3 days</option><option>7 days</option></select></label>
          <label className="field">Bumps per day <select><option>3</option><option>6</option></select></label>
          <label className="field">Slot <select><option>Morning</option><option>Afternoon</option><option>Evening</option><option>Night</option></select></label>
          <label className="flex gap-2 text-[13px]"><input type="checkbox" /> Auto Boost</label>
          <p className="text-[12px] text-[#888]">Cut-off: next slot may start tomorrow. Subscriber extra bump. Slot vs hourly saving shown at checkout.</p>
          <p className="font-bold">Price: 80 credits</p>
          <label className="flex gap-2 text-[13px]"><input type="checkbox" /> Auto-renewal</label>
          <button type="button" className="btn-post self-start" onClick={() => setScreen("upgrades")}>Add to basket</button>
          <button type="button" className="text-sm underline" onClick={() => setScreen("form")}>Back</button>
        </div>
      ) : null}

      {screen === "star" ? (
        <div className="panel">
          <h1 className="text-[22px]">Star calendar</h1>
          <p className="text-[13px]">7-day grid × 2 slots (10:00–22:00, 22:00–10:00). 6 spots each. Needs 1 Safe photo + nickname.</p>
          <div className="mt-3 grid grid-cols-2 gap-1 text-[12px] md:grid-cols-4">
            {Array.from({ length: 14 }, (_, i) => (
              <button key={i} type="button" className={`border p-2 ${i === 3 ? "bg-[#eee] text-[#aaa]" : "bg-white"}`} disabled={i === 3}>
                Day {Math.floor(i / 2) + 1} {i % 2 ? "Night" : "Day"} {i === 3 ? "Sold out" : `${6 - (i % 5)} free`}
              </button>
            ))}
          </div>
          <p className="mt-3 font-bold">Selected: 1 · 400 credits</p>
          <button type="button" className="btn-post mt-2" onClick={() => setScreen("basket")}>Add to basket</button>
        </div>
      ) : null}

      {screen === "flash" ? (
        <div className="panel grid gap-2">
          <h1 className="text-[22px]">Flash configuration</h1>
          <p>Starts now · 4 hours · 5 bumps in first hour · Super Top + Highlight look · Available now badge</p>
          <p className="font-bold">Price: 120 credits</p>
          <button type="button" className="btn-post self-start" onClick={() => setScreen("basket")}>Add to basket</button>
        </div>
      ) : null}

      {screen === "upgrades" ? (
        <div className="panel grid gap-2">
          <h1 className="text-[22px]">Upgrades</h1>
          {["Super Top", "Highlight", "New label (animated)", "All Extras bundle"].map((u) => (
            <label key={u} className="flex gap-2 border p-2 text-[13px]"><input type="checkbox" /> {u}</label>
          ))}
          <button type="button" className="btn-post self-start" onClick={() => setScreen("basket")}>Continue to basket</button>
        </div>
      ) : null}

      {screen === "basket" ? (
        <div className="panel grid gap-3">
          <h1 className="text-[22px]">Basket and checkout</h1>
          <p>Top 3 days · 80 credits <button type="button" className="underline" onClick={() => confirm("Remove item?")}>remove</button></p>
          <label className="field">Coupon <span className="flex gap-2"><input /><button type="button" className="btn-ghost">Apply</button></span></label>
          <p>Wallet: 1,200 credits · Total 80 credits / ₹800</p>
          <label className="flex gap-2 text-[13px]"><input type="checkbox" defaultChecked /> I agree: immediate start, no withdrawal</label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-post" onClick={() => setScreen("result")}>Pay with credits</button>
            <button type="button" className="btn-ghost" onClick={() => setScreen("billing")}>Pay now (card / UPI)</button>
            <Link href="/u/account/credits/" className="text-sm">Low credits? Buy pack</Link>
          </div>
        </div>
      ) : null}

      {screen === "billing" ? (
        <div className="panel grid gap-2">
          <h1 className="text-[22px]">Billing address</h1>
          {["Name", "Address", "City", "State", "Postal code", "Country", "GSTIN (optional)"].map((f) => (
            <label key={f} className="field">{f}<input defaultValue={f === "Country" ? "India" : ""} /></label>
          ))}
          <button type="button" className="btn-post self-start" onClick={() => setScreen("result")}>Save and pay</button>
        </div>
      ) : null}

      {screen === "duplicate" ? (
        <div className="panel">
          <h1 className="text-[22px]">Duplicate text</h1>
          <p className="text-[13px]">This text matches an existing ad. Edit myself or generate with AI (uses phone number).</p>
          <textarea className="mt-3 w-full border p-2" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} />
          <p className="text-[12px]">Regenerate 0/3</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-post" onClick={() => setScreen("form")}>Use this text</button>
            <button type="button" className="btn-ghost" onClick={() => setScreen("form")}>Edit myself</button>
          </div>
        </div>
      ) : null}

      {screen === "limit" ? (
        <div className="panel">
          <h1 className="text-[22px]">Weekly limit reached</h1>
          <p>Free ads used this week for this phone. Promote this ad, buy a Publishing Pack, or save as draft.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-post" onClick={() => { setScreen("form"); setStep(3); }}>Promote this ad</button>
            <Link href="/u/account/packs/" className="btn-ghost">Buy a Publishing Pack</Link>
          </div>
        </div>
      ) : null}

      {phoneOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-sm bg-white p-6">
            <h3 className="font-bold">Phone verification</h3>
            <p className="mt-2 text-[13px]">6-digit code · 5 min timer · resend · didn&apos;t receive the SMS?</p>
            <input className="mt-3 w-full border px-3 py-2 tracking-[0.4em]" maxLength={6} placeholder="SMS code" />
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn-post" onClick={() => setPhoneOpen(false)}>Verify</button>
              <button type="button" className="btn-ghost" onClick={() => setPhoneOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}

      {picker ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-lg bg-white p-6">
            <h3 className="font-bold">Media picker</h3>
            <p className="text-[13px]">Albums · Safe / Restricted / Rejected badges</p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {["p1", "p2", "p3", "p4"].map((p) => (
                <button key={p} type="button" onClick={() => { setPhotos([`/placeholders/${p}.svg`]); setPicker(false); }}>
                  <img src={`/placeholders/${p}.jpg`} alt="" />
                </button>
              ))}
            </div>
            <button type="button" className="mt-3 text-sm underline" onClick={() => setPicker(false)}>Close</button>
          </div>
        </div>
      ) : null}

      <p className="mt-4 hidden text-[11px] text-[#aaa]">{pack.credits} pack default</p>
    </div>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel">
      <h1 className="text-[22px]">{title}</h1>
      <div className="mt-3 text-[14px] leading-6">{children}</div>
    </div>
  );
}
