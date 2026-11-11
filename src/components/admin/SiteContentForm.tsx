"use client";

import { useState } from "react";
import { api } from "@/lib/ui/api";
import { resetHomepageForAdmin, saveHomepageForAdmin } from "@/app/admin/content-actions";
import type { NavLink, SiteContent } from "@/lib/ui/site-content";

type Part = "home" | "menus";

function move<T>(list: T[], index: number, dir: -1 | 1) {
  const next = [...list];
  const target = index + dir;
  if (target < 0 || target >= next.length) return list;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

async function uploadPhoto(file: File) {
  const signed = await api<{
    uploadUrl: string;
    apiKey: string;
    timestamp: number;
    signature: string;
    folder: string;
    mediaId: string;
  }>("/api/media/sign", {
    method: "POST",
    body: JSON.stringify({ contentType: file.type, byteSize: file.size, kind: "image" }),
  });
  if (!signed.ok) throw new Error("Upload is unavailable. Paste a path such as /placeholders/hero.webp.");
  const body = new FormData();
  body.append("file", file);
  body.append("api_key", signed.data.apiKey);
  body.append("timestamp", String(signed.data.timestamp));
  body.append("signature", signed.data.signature);
  body.append("folder", signed.data.folder);
  body.append("public_id", signed.data.mediaId);
  const uploaded = await fetch(signed.data.uploadUrl, { method: "POST", body });
  const payload = (await uploaded.json().catch(() => null)) as { secure_url?: string } | null;
  if (!uploaded.ok || !payload?.secure_url) throw new Error("Upload is unavailable. Paste a path such as /placeholders/hero.webp.");
  await api("/api/media/complete", { method: "POST", body: JSON.stringify({ mediaId: signed.data.mediaId }) }).catch(() => null);
  return payload.secure_url;
}

function PhotoField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <label className="tk-field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setNote("");
          try {
            onChange(await uploadPhoto(file));
          } catch (error) {
            setNote(error instanceof Error ? error.message : "Upload is unavailable. Paste a path such as /placeholders/hero.webp.");
          }
        }}
      />
      {note ? <span className="tk-error">{note}</span> : null}
    </label>
  );
}

function LinkRows({
  links,
  onChange,
}: {
  links: NavLink[];
  onChange: (links: NavLink[]) => void;
}) {
  return (
    <div className="grid gap-2">
      {links.map((link, index) => (
        <div key={`${link.href}-${index}`} className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
          <input aria-label="Label" value={link.label} onChange={(event) => {
            const next = [...links];
            next[index] = { ...link, label: event.target.value };
            onChange(next);
          }} />
          <input aria-label="Link" value={link.href} onChange={(event) => {
            const next = [...links];
            next[index] = { ...link, href: event.target.value };
            onChange(next);
          }} />
          <label className="t-small">
            <input type="checkbox" checked={link.visible} onChange={(event) => {
              const next = [...links];
              next[index] = { ...link, visible: event.target.checked };
              onChange(next);
            }} /> show
          </label>
          <span>
            <button type="button" className="tk-btn tk-btn-outline-gold" onClick={() => onChange(move(links, index, -1))}>Up</button>
            <button type="button" className="tk-btn tk-btn-outline-gold" onClick={() => onChange(move(links, index, 1))}>Down</button>
          </span>
        </div>
      ))}
      <button type="button" className="tk-btn tk-btn-outline-gold" onClick={() => onChange([...links, { label: "New link", href: "/", visible: true }])}>
        Add link
      </button>
    </div>
  );
}

export function SiteContentForm({
  part,
  initial,
  categories,
  cities,
}: {
  part: Part;
  initial: SiteContent;
  categories: { slug: string; name: string }[];
  cities: { slug: string; name: string }[];
}) {
  const [content, setContent] = useState(initial);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  function patch(next: SiteContent) {
    setContent(next);
  }

  async function save() {
    setBusy(true);
    setErr("");
    setMsg("");
    const result = await saveHomepageForAdmin(content);
    setBusy(false);
    if (!result.ok) {
      setErr(result.message);
      return;
    }
    setContent(result.content);
    setMsg("Saved. Open the home page to see it.");
  }

  async function reset() {
    if (!window.confirm("Reset this homepage to the original text and pictures?")) return;
    setBusy(true);
    setErr("");
    const result = await resetHomepageForAdmin();
    setBusy(false);
    if (!result.ok) {
      setErr(result.message);
      return;
    }
    setContent(result.content);
    setMsg("Reset to the original homepage.");
  }

  const cityHint = cities.slice(0, 12).map((city) => city.slug).join(", ");

  return (
    <div className="grid gap-4">
      {part === "home" ? (
        <>
          <section className="rounded-lg border border-line bg-surface p-4 text-text">
            <h2 className="font-bold">Hero</h2>
            <div className="mt-3 grid gap-3">
              <label className="tk-field">
                Desktop headline
                <input id="hero-desktop" value={content.hero.desktop} onChange={(event) => patch({ ...content, hero: { ...content.hero, desktop: event.target.value } })} />
              </label>
              <label className="tk-field">
                Mobile headline, one line per row
                <textarea rows={4} value={content.hero.mobileLines.join("\n")} onChange={(event) => patch({ ...content, hero: { ...content.hero, mobileLines: event.target.value.split("\n") } })} />
              </label>
              <PhotoField label="Hero photo" value={content.hero.photo} onChange={(photo) => patch({ ...content, hero: { ...content.hero, photo } })} />
              <label className="tk-field">
                Search box text
                <input value={content.hero.searchPlaceholder} onChange={(event) => patch({ ...content, hero: { ...content.hero, searchPlaceholder: event.target.value } })} />
              </label>
              <label className="tk-field">
                Post button text
                <input value={content.hero.postLabel} onChange={(event) => patch({ ...content, hero: { ...content.hero, postLabel: event.target.value }, header: { ...content.header, postLabel: event.target.value }, footer: { ...content.footer, postLabel: event.target.value } })} />
              </label>
              <p className="t-small text-muted">The post button always opens the ad form. Logged-out visitors are asked to log in first.</p>
            </div>
          </section>
          <section className="rounded-lg border border-line bg-surface p-4 text-text">
            <h2 className="font-bold">Section titles and search text</h2>
            <div className="mt-3 grid gap-3">
              <label className="tk-field">Heading<input value={content.cardsHeading} onChange={(event) => patch({ ...content, cardsHeading: event.target.value })} /></label>
              <label className="tk-field">Intro<input value={content.cardsIntro} onChange={(event) => patch({ ...content, cardsIntro: event.target.value })} /></label>
              <label className="tk-field">Page title<input value={content.seoTitle} onChange={(event) => patch({ ...content, seoTitle: event.target.value })} /></label>
              <label className="tk-field">Page description<textarea rows={3} value={content.seoDescription} onChange={(event) => patch({ ...content, seoDescription: event.target.value })} /></label>
              <label className="tk-field">Extra text under the cards<textarea rows={4} value={content.seoIntro} onChange={(event) => patch({ ...content, seoIntro: event.target.value })} /></label>
            </div>
          </section>
          <section className="rounded-lg border border-line bg-surface p-4 text-text">
            <h2 className="font-bold">Category cards</h2>
            <p className="t-small text-muted">Leave the title or description blank to keep the category’s own words. City slugs, one per line. Known cities: {cityHint}</p>
            <div className="mt-3 grid gap-3">
              {content.cards.map((card, index) => (
                <article key={`${card.slug}-${index}`} className="border p-3">
                  <div className="flex flex-wrap gap-2">
                    <label className="t-small"><input type="checkbox" checked={card.visible} onChange={(event) => {
                      const cards = [...content.cards];
                      cards[index] = { ...card, visible: event.target.checked };
                      patch({ ...content, cards });
                    }} /> show</label>
                    <button type="button" className="tk-btn tk-btn-outline-gold" onClick={() => patch({ ...content, cards: move(content.cards, index, -1) })}>Up</button>
                    <button type="button" className="tk-btn tk-btn-outline-gold" onClick={() => patch({ ...content, cards: move(content.cards, index, 1) })}>Down</button>
                  </div>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <label className="tk-field">Category
                      <select value={card.slug} onChange={(event) => {
                        const cards = [...content.cards];
                        cards[index] = { ...card, slug: event.target.value };
                        patch({ ...content, cards });
                      }}>
                        {categories.map((cat) => <option key={cat.slug} value={cat.slug}>{cat.name}</option>)}
                      </select>
                    </label>
                    <label className="tk-field">Title<input value={card.title} onChange={(event) => {
                      const cards = [...content.cards];
                      cards[index] = { ...card, title: event.target.value };
                      patch({ ...content, cards });
                    }} /></label>
                    <PhotoField label="Photo" value={card.photo} onChange={(photo) => {
                      const cards = [...content.cards];
                      cards[index] = { ...card, photo };
                      patch({ ...content, cards });
                    }} />
                    <label className="tk-field">Description<textarea rows={3} value={card.blurb} onChange={(event) => {
                      const cards = [...content.cards];
                      cards[index] = { ...card, blurb: event.target.value };
                      patch({ ...content, cards });
                    }} /></label>
                    <label className="tk-field md:col-span-2">Cities, one slug per line
                      <textarea rows={3} value={card.cities.join("\n")} onChange={(event) => {
                        const cards = [...content.cards];
                        cards[index] = { ...card, cities: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) };
                        patch({ ...content, cards });
                      }} />
                    </label>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="rounded-lg border border-line bg-surface p-4 text-text">
            <h2 className="font-bold">City rows</h2>
            <p className="t-small text-muted">Leave cities blank to keep the current top cities. The last row can list extra categories.</p>
            <div className="mt-3 grid gap-3">
              {content.groups.map((group, index) => (
                <article key={group.id} className="border p-3">
                  <div className="flex flex-wrap gap-2">
                    <strong>{group.kind === "categories" ? "More categories" : group.slug}</strong>
                    <label className="t-small"><input type="checkbox" checked={group.visible} onChange={(event) => {
                      const groups = [...content.groups];
                      groups[index] = { ...group, visible: event.target.checked };
                      patch({ ...content, groups });
                    }} /> show</label>
                    <button type="button" className="tk-btn tk-btn-outline-gold" onClick={() => patch({ ...content, groups: move(content.groups, index, -1) })}>Up</button>
                    <button type="button" className="tk-btn tk-btn-outline-gold" onClick={() => patch({ ...content, groups: move(content.groups, index, 1) })}>Down</button>
                    {group.kind === "cities" ? (
                      <label className="t-small"><input type="checkbox" checked={group.showAll} onChange={(event) => {
                        const groups = [...content.groups];
                        groups[index] = { ...group, showAll: event.target.checked };
                        patch({ ...content, groups });
                      }} /> All cities link</label>
                    ) : null}
                  </div>
                  <label className="tk-field mt-2">Title<input value={group.title} onChange={(event) => {
                    const groups = [...content.groups];
                    groups[index] = { ...group, title: event.target.value };
                    patch({ ...content, groups });
                  }} /></label>
                  <label className="tk-field">Slugs, one per line<textarea rows={3} value={group.cities.join("\n")} onChange={(event) => {
                    const groups = [...content.groups];
                    groups[index] = { ...group, cities: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) };
                    patch({ ...content, groups });
                  }} /></label>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="rounded-lg border border-line bg-surface p-4 text-text">
            <h2 className="font-bold">Header and mobile menu</h2>
            <div className="mt-3 grid gap-3">
              <label className="tk-field">Publish label<input value={content.header.publishLabel} onChange={(event) => patch({ ...content, header: { ...content.header, publishLabel: event.target.value } })} /></label>
              <label className="tk-field">Services label<input value={content.header.servicesLabel} onChange={(event) => patch({ ...content, header: { ...content.header, servicesLabel: event.target.value } })} /></label>
              <label className="tk-field">Follow label<input value={content.header.followLabel} onChange={(event) => patch({ ...content, header: { ...content.header, followLabel: event.target.value } })} /></label>
              <label className="tk-field">Search field text<input value={content.header.searchModalPlaceholder} onChange={(event) => patch({ ...content, header: { ...content.header, searchModalPlaceholder: event.target.value } })} /></label>
              <label className="tk-field">Search button<input value={content.header.searchSubmit} onChange={(event) => patch({ ...content, header: { ...content.header, searchSubmit: event.target.value } })} /></label>
              <LinkRows links={content.header.drawer} onChange={(drawer) => patch({ ...content, header: { ...content.header, drawer } })} />
            </div>
          </section>
          <section className="rounded-lg border border-line bg-surface p-4 text-text">
            <h2 className="font-bold">Footer</h2>
            <div className="mt-3 grid gap-3">
              <label className="tk-field">About. Use {"{count}"} where the city total should sit.<textarea rows={3} value={content.footer.about} onChange={(event) => patch({ ...content, footer: { ...content.footer, about: event.target.value } })} /></label>
              <label className="tk-field">Badge<input value={content.footer.badge} onChange={(event) => patch({ ...content, footer: { ...content.footer, badge: event.target.value } })} /></label>
              <label className="tk-field">Boost heading<input value={content.footer.boostTitle} onChange={(event) => patch({ ...content, footer: { ...content.footer, boostTitle: event.target.value } })} /></label>
              <label className="tk-field">Copyright<input value={content.footer.copyright} onChange={(event) => patch({ ...content, footer: { ...content.footer, copyright: event.target.value } })} /></label>
              <label className="tk-field">Back to top<input value={content.footer.backToTop} onChange={(event) => patch({ ...content, footer: { ...content.footer, backToTop: event.target.value } })} /></label>
              <label className="tk-field">Countries label<input value={content.footer.countriesLabel} onChange={(event) => patch({ ...content, footer: { ...content.footer, countriesLabel: event.target.value } })} /></label>
              <label className="tk-field">Country name<input value={content.footer.countryOption} onChange={(event) => patch({ ...content, footer: { ...content.footer, countryOption: event.target.value } })} /></label>
              {content.footer.columns.map((column, index) => (
                <article key={`${column.title}-${index}`} className="border p-3">
                  <label className="t-small"><input type="checkbox" checked={column.visible} onChange={(event) => {
                    const columns = [...content.footer.columns];
                    columns[index] = { ...column, visible: event.target.checked };
                    patch({ ...content, footer: { ...content.footer, columns } });
                  }} /> show</label>
                  <label className="tk-field">Column title<input value={column.title} onChange={(event) => {
                    const columns = [...content.footer.columns];
                    columns[index] = { ...column, title: event.target.value };
                    patch({ ...content, footer: { ...content.footer, columns } });
                  }} /></label>
                  <LinkRows links={column.links} onChange={(links) => {
                    const columns = [...content.footer.columns];
                    columns[index] = { ...column, links };
                    patch({ ...content, footer: { ...content.footer, columns } });
                  }} />
                  <button type="button" className="tk-btn tk-btn-outline-gold" onClick={() => {
                    const columns = move(content.footer.columns, index, -1);
                    patch({ ...content, footer: { ...content.footer, columns } });
                  }}>Up</button>
                  <button type="button" className="tk-btn tk-btn-outline-gold" onClick={() => {
                    const columns = move(content.footer.columns, index, 1);
                    patch({ ...content, footer: { ...content.footer, columns } });
                  }}>Down</button>
                </article>
              ))}
            </div>
          </section>
          <section className="rounded-lg border border-line bg-surface p-4 text-text">
            <h2 className="font-bold">Age gate, cookies, and support</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="tk-field">Age title<input value={content.age.title} onChange={(event) => patch({ ...content, age: { ...content.age, title: event.target.value } })} /></label>
              <label className="tk-field">Age lead<input value={content.age.lead} onChange={(event) => patch({ ...content, age: { ...content.age, lead: event.target.value } })} /></label>
              <label className="tk-field">Age rest<input value={content.age.rest} onChange={(event) => patch({ ...content, age: { ...content.age, rest: event.target.value } })} /></label>
              <label className="tk-field">Terms link text<input value={content.age.terms} onChange={(event) => patch({ ...content, age: { ...content.age, terms: event.target.value } })} /></label>
              <label className="tk-field">Accept button<input value={content.age.yes} onChange={(event) => patch({ ...content, age: { ...content.age, yes: event.target.value } })} /></label>
              <label className="tk-field">Decline button<input value={content.age.no} onChange={(event) => patch({ ...content, age: { ...content.age, no: event.target.value } })} /></label>
              <label className="tk-field">Decline link<input value={content.age.noHref} onChange={(event) => patch({ ...content, age: { ...content.age, noHref: event.target.value } })} /></label>
              <label className="tk-field md:col-span-2">Cookie text<textarea rows={2} value={content.cookies.body} onChange={(event) => patch({ ...content, cookies: { ...content.cookies, body: event.target.value } })} /></label>
              <label className="tk-field">Cookie link text<input value={content.cookies.notice} onChange={(event) => patch({ ...content, cookies: { ...content.cookies, notice: event.target.value } })} /></label>
              <label className="tk-field">Accept cookies<input value={content.cookies.accept} onChange={(event) => patch({ ...content, cookies: { ...content.cookies, accept: event.target.value } })} /></label>
              <label className="tk-field">Necessary only<input value={content.cookies.necessary} onChange={(event) => patch({ ...content, cookies: { ...content.cookies, necessary: event.target.value } })} /></label>
              <label className="tk-field">Support hours<input value={content.support.hours} onChange={(event) => patch({ ...content, support: { ...content.support, hours: event.target.value } })} /></label>
              <label className="tk-field">WhatsApp number<input value={content.support.whatsapp} onChange={(event) => patch({ ...content, support: { ...content.support, whatsapp: event.target.value } })} /></label>
              <label className="tk-field">Telegram<input value={content.support.telegram} onChange={(event) => patch({ ...content, support: { ...content.support, telegram: event.target.value } })} /></label>
            </div>
            <h3 className="mt-4 font-bold">Social links</h3>
            <p className="t-small text-muted">Only https addresses are shown. Leave this empty if you do not have a page yet.</p>
            <LinkRows links={content.socials} onChange={(socials) => patch({ ...content, socials })} />
          </section>
        </>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="tk-btn tk-btn-gold" disabled={busy} onClick={save}>Save</button>
        <button type="button" className="tk-btn tk-btn-outline-gold" disabled={busy} onClick={reset}>Reset to default</button>
        {msg ? <span className="text-[13px] text-[var(--success)]">{msg}</span> : null}
        {err ? <span className="t-small text-danger">{err}</span> : null}
      </div>
    </div>
  );
}
