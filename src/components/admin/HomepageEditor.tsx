"use client";

import { useEffect, useState } from "react";
import { adminList, adminMutate } from "@/app/admin/actions";

type Block = {
  id: string;
  type: "hero" | "categories" | "boost" | "html" | "banner" | "cities";
  enabled: boolean;
  title?: string;
  subtitle?: string;
  body?: string;
  html?: string;
  cta?: string;
  href?: string;
  cityCount?: number;
  moreLabel?: string;
};

type Theme = Record<string, string>;

export function HomepageEditor() {
  const [id, setId] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [theme, setTheme] = useState<Theme>({});
  const [site, setSite] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    adminList("Site")
      .then((items) => {
        const row = items[0] as Record<string, string> & { homepage?: { blocks?: Block[] }; theme?: Theme; _id?: string };
        if (!row) return;
        setId(row._id || "");
        setBlocks(row.homepage?.blocks || []);
        setTheme(
          row.theme && Object.keys(row.theme).length
            ? row.theme
            : { accent: "#e20044", primary: "#00a0e8", page: "#ececec", top: "#ff6a00", link: "#0077b3" },
        );
        setSite({
          name: row.name || "",
          logoText: row.logoText || "",
          tagline: row.tagline || "",
          legalName: row.legalName || "",
          countryName: row.countryName || "",
          searchPlaceholder: row.searchPlaceholder || "",
          postCta: row.postCta || "",
          ageGateTitle: row.ageGateTitle || "",
          ageGateBody: row.ageGateBody || "",
          ageYes: row.ageYes || "",
          ageNo: row.ageNo || "",
          cookieBody: row.cookieBody || "",
          cookieAccept: row.cookieAccept || "",
          cookieNecessary: row.cookieNecessary || "",
          supportHours: row.supportHours || "",
          supportWhatsapp: row.supportWhatsapp || "",
          supportTelegram: row.supportTelegram || "",
        });
      });
  }, []);

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
  }

  function add(type: Block["type"]) {
    setBlocks([
      ...blocks,
      {
        // The click handler needs a unique persisted block identifier.
        // eslint-disable-next-line react-hooks/purity
        id: `${type}-${Date.now()}`,
        type,
        enabled: true,
        title: type === "hero" ? "Headline" : type === "boost" ? "Boost your visibility" : "",
        cityCount: 3,
        moreLabel: "More cities",
        cta: "Post your ad",
        href: "/u/post-insert/",
        html: "<p>Custom HTML block</p>",
      },
    ]);
  }

  async function save() {
    setErr("");
    try {
      await adminMutate({
        model: "Site",
        op: "update",
        id,
        data: { ...site, theme, homepage: { blocks } },
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
      return;
    }
    setMsg("Homepage, chrome and theme saved. Open the home page to see it.");
  }

  if (!id) return <p>Loading site CMS…</p>;

  return (
    <div className="grid gap-4">
      <section className="bg-white p-4">
        <h2 className="font-bold">Site chrome (header, age gate, cookies, footer)</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {Object.entries(site).map(([k, v]) => (
            <label key={k} className="field">
              {k}
              <input value={v} onChange={(e) => setSite({ ...site, [k]: e.target.value })} />
            </label>
          ))}
        </div>
      </section>

      <section className="bg-white p-4">
        <h2 className="font-bold">Theme colours</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {Object.entries(theme).map(([k, v]) => (
            <label key={k} className="field">
              {k}
              <span className="flex gap-2">
                <input type="color" value={v.startsWith("#") ? v : "#000000"} onChange={(e) => setTheme({ ...theme, [k]: e.target.value })} />
                <input value={v} onChange={(e) => setTheme({ ...theme, [k]: e.target.value })} />
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">Homepage blocks (order = live homepage)</h2>
          <div className="flex flex-wrap gap-1 text-[12px]">
            {(["hero", "categories", "boost", "html", "banner", "cities"] as const).map((t) => (
              <button key={t} type="button" className="quiet-btn" onClick={() => add(t)}>
                + {t}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid gap-3">
          {blocks.map((b, i) => (
            <article key={b.id} className="border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="uppercase">{b.type}</strong>
                <label className="flex items-center gap-1 text-[12px]">
                  <input type="checkbox" checked={b.enabled} onChange={(e) => {
                    const next = [...blocks];
                    next[i] = { ...b, enabled: e.target.checked };
                    setBlocks(next);
                  }} />
                  visible
                </label>
                <button type="button" className="quiet-btn" onClick={() => move(i, -1)}>Up</button>
                <button type="button" className="quiet-btn" onClick={() => move(i, 1)}>Down</button>
                <button type="button" className="text-[12px] text-[#e20044]" onClick={() => setBlocks(blocks.filter((x) => x.id !== b.id))}>
                  Remove
                </button>
              </div>
              {b.type === "hero" || b.type === "boost" || b.type === "banner" ? (
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <label className="field">Title <input value={b.title || ""} onChange={(e) => {
                    const next = [...blocks]; next[i] = { ...b, title: e.target.value }; setBlocks(next);
                  }} /></label>
                  <label className="field">Subtitle / body <input value={b.subtitle || b.body || ""} onChange={(e) => {
                    const next = [...blocks]; next[i] = { ...b, subtitle: e.target.value, body: e.target.value }; setBlocks(next);
                  }} /></label>
                  <label className="field">Button <input value={b.cta || ""} onChange={(e) => {
                    const next = [...blocks]; next[i] = { ...b, cta: e.target.value }; setBlocks(next);
                  }} /></label>
                  <label className="field">Link <input value={b.href || ""} onChange={(e) => {
                    const next = [...blocks]; next[i] = { ...b, href: e.target.value }; setBlocks(next);
                  }} /></label>
                </div>
              ) : null}
              {b.type === "categories" ? (
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <label className="field">Cities per category <input type="number" value={b.cityCount || 3} onChange={(e) => {
                    const next = [...blocks]; next[i] = { ...b, cityCount: Number(e.target.value) }; setBlocks(next);
                  }} /></label>
                  <label className="field">More cities label <input value={b.moreLabel || ""} onChange={(e) => {
                    const next = [...blocks]; next[i] = { ...b, moreLabel: e.target.value }; setBlocks(next);
                  }} /></label>
                  <p className="text-[12px] text-[#777] md:col-span-2">Category names, colours, blurbs and featured cities are edited under Categories. Turn a category off the home with showOnHome.</p>
                </div>
              ) : null}
              {b.type === "html" ? (
                <label className="field mt-2">
                  HTML
                  <textarea rows={4} value={b.html || ""} onChange={(e) => {
                    const next = [...blocks]; next[i] = { ...b, html: e.target.value }; setBlocks(next);
                  }} />
                </label>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button type="button" className="gold-btn" onClick={save}>
          Save homepage &amp; chrome
        </button>
        {msg ? <span className="text-[13px] text-[var(--success)]">{msg}</span> : null}
        {err ? <span className="text-[13px] text-[#e20044]">{err}</span> : null}
      </div>
    </div>
  );
}
