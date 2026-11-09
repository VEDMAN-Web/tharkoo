"use client";

import { useState } from "react";
import Link from "next/link";
import type { ListingDoc } from "@/lib/models";

export function AdDetail({
  ad,
  categoryName,
}: {
  ad: ListingDoc;
  categoryName: string;
}) {
  const [photo, setPhoto] = useState(0);
  const [email, setEmail] = useState(false);
  const [save, setSave] = useState(false);
  const [restricted, setRestricted] = useState(false);
  const [saved, setSaved] = useState(false);
  const photos = ad.photos?.length ? ad.photos : ["/placeholders/empty.svg"];
  const showRestricted = restricted ? "/placeholders/restricted.svg" : photos[photo];

  return (
    <>
      <p className="text-[12px] uppercase tracking-wide text-[#888]">
        {ad.publishedAt ? new Date(ad.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) : ""}{" "}
        - Ad ID: {ad.publicId}
      </p>
      <h1 className="mt-2 text-[22px] font-bold leading-snug text-[#222]">{ad.title}</h1>
      <p className="mt-2 text-[14px]">
        <strong>{ad.displayName}</strong>
        {ad.verified ? <span className="ml-2 text-[12px] text-[var(--sk-verified)]">ID verified</span> : null}
      </p>
      <p className="text-[13px] text-[#666]">
        {ad.age} years {ad.citySlug}
        {ad.place ? ` / ${ad.place}` : ""}
      </p>

      <div className="mt-4 bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={showRestricted} alt="Placeholder portrait" className="mx-auto max-h-[420px] object-contain" />
        {photos.length > 1 ? (
          <div className="flex gap-1 overflow-x-auto bg-[#111] p-2">
            {photos.map((src, i) => (
              <button key={src + i} type="button" onClick={() => setPhoto(i)} className={`h-14 w-14 overflow-hidden ${i === photo ? "ring-2 ring-white" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <button type="button" className="mt-2 text-[12px] underline" onClick={() => setRestricted(true)}>
        Some photos are restricted
      </button>

      <h2 className="mt-6 text-[16px] font-bold">About me</h2>
      <p className="mt-2 max-w-3xl whitespace-pre-wrap text-[14px] leading-6">{ad.description}</p>
      <dl className="mt-4 grid max-w-md grid-cols-2 gap-2 text-sm">
        <dt className="text-[#777]">Category</dt>
        <dd>{categoryName}</dd>
        <dt className="text-[#777]">City</dt>
        <dd>{ad.citySlug}</dd>
        <dt className="text-[#777]">Age</dt>
        <dd>{ad.age}</dd>
      </dl>

      <h2 className="mt-6 text-[16px] font-bold">Contact me</h2>
      <div className="mt-3 flex max-w-md flex-col gap-2">
        {ad.phone ? (
          <a className="contact-btn bg-[var(--sk-call)]" href={`tel:${ad.phone}`}>
            Call
          </a>
        ) : null}
        {ad.whatsapp ? (
          <a className="contact-btn bg-[var(--sk-wa)]" href={`https://wa.me/91${ad.whatsapp}`}>
            WhatsApp
          </a>
        ) : null}
        {ad.telegram ? (
          <a className="contact-btn bg-[var(--sk-tg)]" href={`https://t.me/${ad.telegram}`}>
            Telegram
          </a>
        ) : null}
        {ad.emailOn ? (
          <button type="button" className="contact-btn bg-[var(--sk-mail)]" onClick={() => setEmail(true)}>
            Email
          </button>
        ) : null}
      </div>
      <div className="mt-4 flex gap-4 text-[13px]">
        <button className="underline" type="button" onClick={() => setSave(true)}>
          {saved ? "Contact saved" : "Save contact"}
        </button>
        <Link href={`/submit-report/?ad=${ad.publicId}`}>Report this ad</Link>
      </div>

      {email ? (
        <Modal title="Email this advertiser" onClose={() => setEmail(false)}>
          <p className="text-[13px] text-[#555]">Tharkoo relays your message. Your address stays hidden until they reply.</p>
          <form
            className="mt-3 grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setEmail(false);
              alert("Message queued (demo).");
            }}
          >
            <input className="border px-3 py-2" required type="email" placeholder="Your email" />
            <textarea className="border px-3 py-2" required rows={4} placeholder="Message" />
            <button className="btn-post">Send message</button>
          </form>
        </Modal>
      ) : null}

      {save ? (
        <Modal title="Save contact" onClose={() => setSave(false)}>
          <p className="text-[13px]">Give this contact a nickname. Saved in your account.</p>
          <form
            className="mt-3 grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSaved(true);
              setSave(false);
            }}
          >
            <input className="border px-3 py-2" defaultValue={ad.displayName} maxLength={20} />
            <button className="btn-post">Save</button>
            <Link href="/u/login/" className="text-sm">
              Need an account? Log in
            </Link>
          </form>
        </Modal>
      ) : null}

      {restricted ? (
        <Modal title="Restricted media" onClose={() => setRestricted(false)}>
          <p className="text-[13px]">This gallery includes age-gated photos. Confirm you are 18+ to continue. We show clothed placeholders only on this demo.</p>
          <div className="mt-4 flex gap-2">
            <Link href="/u/age-verification/" className="btn-post">
              Start age check
            </Link>
            <button type="button" className="btn-ghost" onClick={() => setRestricted(false)}>
              Keep placeholders
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">{title}</h3>
          <button type="button" onClick={onClose} className="text-sm underline">
            Close
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
