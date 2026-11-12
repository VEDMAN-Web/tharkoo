"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PATH_KEYS, adPath, blogPath, categoryPath, cmsPath, joinPath, placePath, tagPath, type UrlPaths } from "@/lib/urls";
import {
  addRedirectAction,
  deleteRedirectAction,
  editRedirectAction,
  exportRedirectsAction,
  importRedirectsAction,
  renameAdAction,
  renameCategoryAction,
  renameContentAction,
  renameLocationAction,
  renameTagAction,
  savePrefixesAction,
  searchAdsAction,
} from "@/app/admin/url-actions";

type Row = { id: string; name?: string; title?: string; slug: string; type?: string };
type RedirectRow = { id: string; from: string; to: string; hits: number; enabled: boolean };

const LABELS: Record<(typeof PATH_KEYS)[number], string> = {
  ad: "Ad",
  tag: "Tag",
  search: "Search",
  blog: "Blog",
  help: "Help",
  cities: "Cities",
  cms: "Pages",
  contact: "Contact",
  postAd: "Post ad",
  login: "Log in",
  register: "Register",
  submitReport: "Report",
};

function noteOf(result: { ok: boolean; message?: string }) {
  return result.ok ? "Saved. Old URLs redirect, and the sitemap was refreshed." : result.message || "Save failed";
}

export function UrlsManager({
  origin,
  paths,
  categories,
  places,
  tags,
  pages,
  posts,
  redirects,
}: {
  origin: string;
  paths: UrlPaths;
  categories: Row[];
  places: Row[];
  tags: { slug: string; label: string }[];
  pages: Row[];
  posts: Row[];
  redirects: RedirectRow[];
}) {
  const router = useRouter();
  const [prefix, setPrefix] = useState<UrlPaths>(paths);
  const [message, setMessage] = useState("");
  const [ads, setAds] = useState<{ id: string; slug: string; title: string }[]>([]);
  const [csv, setCsv] = useState("");

  async function done(result: { ok: boolean; message?: string }) {
    setMessage(noteOf(result));
    if (result.ok) router.refresh();
  }

  return (
    <div className="grid min-w-0 max-w-3xl gap-4" data-tk="url-manager">
      <p className="t-small text-muted">Change a public slug or prefix. The previous URL keeps working with a permanent redirect, and the sitemap refreshes.</p>
      {message ? <p className="t-small" aria-live="polite">{message}</p> : null}

      <section className="tk-profile grid gap-3">
        <h2 className="t-h3">Path prefixes</h2>
        {PATH_KEYS.map((key) => (
          <label key={key} className="grid gap-1">
            <span className="t-small">{LABELS[key]}</span>
            <input className="w-full min-w-0 rounded border px-2 py-1" value={prefix[key]} onChange={(event) => setPrefix({ ...prefix, [key]: event.target.value })} />
            <span className="t-small break-all text-muted">{origin}{joinPath(prefix[key])}</span>
          </label>
        ))}
        <button
          type="button"
          className="tk-btn tk-btn-primary w-fit"
          onClick={() => savePrefixesAction(prefix).then(done)}
        >
          Save prefixes
        </button>
      </section>

      <SlugGroup title="Categories" rows={categories} preview={(slug) => `${origin}${categoryPath(slug || "category")}`} onSave={(row, slug) => renameCategoryAction(row.id, slug).then(done)} />
      <SlugGroup title="States, cities, and districts" rows={places} preview={(slug, row) => `${origin}${placePath("category", row.type === "district" ? "city" : slug, row.type === "district" ? slug : undefined)}`} onSave={(row, slug) => renameLocationAction(row.id, slug).then(done)} />
      <SlugGroup title="Tags" rows={tags.map((tag) => ({ id: tag.slug, slug: tag.slug, name: tag.label }))} preview={(slug) => `${origin}${tagPath(prefix, "category", slug || "tag")}`} onSave={(row, slug) => renameTagAction(row.id, slug).then(done)} />
      <SlugGroup title="Pages" rows={pages} preview={(slug) => `${origin}${cmsPath(prefix, slug || "page")}`} onSave={(row, slug) => renameContentAction("page", row.id, slug).then(done)} />
      <SlugGroup title="Blog" rows={posts} preview={(slug) => `${origin}${blogPath(prefix, slug || "post")}`} onSave={(row, slug) => renameContentAction("post", row.id, slug).then(done)} />

      <section className="tk-profile grid gap-3">
        <h2 className="t-h3">Ad slugs</h2>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const result = await searchAdsAction(String(new FormData(event.currentTarget).get("q") || ""));
            if (!result.ok) return setMessage(result.message);
            setAds(result.ads);
          }}
        >
          <input name="q" placeholder="Search a title or slug" className="min-w-0 flex-1 rounded border px-2 py-1" />
          <button className="tk-btn tk-btn-primary" type="submit">Search</button>
        </form>
        {ads.map((ad) => (
          <SlugField key={ad.id} label={ad.title || ad.slug} slug={ad.slug} preview={(value) => `${origin}${adPath(prefix, value || ad.slug)}`} onSave={(value) => renameAdAction(ad.id, value).then(done)} />
        ))}
      </section>

      <section className="tk-profile grid gap-3">
        <h2 className="t-h3">Redirects</h2>
        <form
          className="grid gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            await done(await addRedirectAction(String(form.get("from") || ""), String(form.get("to") || "")));
            event.currentTarget.reset();
          }}
        >
          <input name="from" required placeholder="/old/" className="rounded border px-2 py-1" />
          <input name="to" required placeholder="/new/" className="rounded border px-2 py-1" />
          <button className="tk-btn tk-btn-primary w-fit" type="submit">Add redirect</button>
        </form>
        <div className="max-w-full min-w-0 overflow-x-auto">
          <table className="w-full text-left t-small">
            <thead>
              <tr><th>From</th><th>To</th><th>Hits</th><th></th></tr>
            </thead>
            <tbody>
              {redirects.map((row) => (
                <tr key={row.id}>
                  <td className="break-all pr-2">{row.from}</td>
                  <td className="pr-2">
                    <input defaultValue={row.to} className="w-full min-w-32 rounded border px-2 py-1" id={`to-${row.id}`} />
                  </td>
                  <td>{row.hits}</td>
                  <td className="whitespace-nowrap">
                    <button type="button" className="mr-2 underline" onClick={() => editRedirectAction(row.id, (document.getElementById(`to-${row.id}`) as HTMLInputElement | null)?.value || row.to).then(done)}>Save</button>
                    <button type="button" className="underline" onClick={() => deleteRedirectAction(row.id).then(done)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="tk-btn"
            onClick={async () => {
              const result = await exportRedirectsAction();
              if (!result.ok) return setMessage(result.message);
              const blob = new Blob([result.csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = "redirects.csv";
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export CSV
          </button>
        </div>
        <textarea value={csv} onChange={(event) => setCsv(event.target.value)} rows={4} placeholder="from,to" className="rounded border px-2 py-1" />
        <button type="button" className="tk-btn tk-btn-primary w-fit" onClick={() => importRedirectsAction(csv).then(done)}>Import CSV</button>
      </section>
    </div>
  );
}

function SlugGroup({
  title,
  rows,
  preview,
  onSave,
}: {
  title: string;
  rows: Row[];
  preview: (slug: string, row: Row) => string;
  onSave: (row: Row, slug: string) => void;
}) {
  return (
    <details className="tk-profile">
      <summary className="t-h3 cursor-pointer">{title}</summary>
      <div className="mt-3 grid gap-2">
        {rows.map((row) => (
          <SlugField key={row.id + row.slug} label={`${row.name || row.title || row.slug}${row.type ? ` · ${row.type}` : ""}`} slug={row.slug} preview={(value) => preview(value, row)} onSave={(value) => onSave(row, value)} />
        ))}
      </div>
    </details>
  );
}

function SlugField({ label, slug, preview, onSave }: { label: string; slug: string; preview: (value: string) => string; onSave: (value: string) => void }) {
  const [value, setValue] = useState(slug);
  return (
    <form
      className="grid gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(value);
      }}
    >
      <span className="t-small">{label}</span>
      <div className="flex flex-wrap gap-2">
        <input value={value} onChange={(event) => setValue(event.target.value)} className="min-w-0 flex-1 rounded border px-2 py-1" />
        <button className="tk-btn tk-btn-primary" type="submit">Save</button>
      </div>
      <span className="t-small break-all text-muted">{preview(value)}</span>
    </form>
  );
}
