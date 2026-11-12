"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Notice } from "@/components/admin/ui";
import { explainUrlAction } from "../actions";
import { submitIndexNowAction } from "./actions";

export interface ShardInfo {
  shard: string;
  count: number;
  sample: string[];
}

export interface LogRow {
  at: string;
  urls: number;
  sent: boolean;
  note: string;
}

export function SitemapPreview({ shards }: { shards: ShardInfo[] }) {
  return (
    <section className="adm-card" style={{ display: "grid", gap: 10 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Sitemaps</h2>
      <p className="adm-field-help" style={{ margin: 0 }}>
        What each sitemap file lists right now, under the rules above.
      </p>
      {shards.map((item) => (
        <details key={item.shard}>
          <summary style={{ cursor: "pointer", minHeight: 32 }}>
            <strong>{item.shard}</strong>: {item.count.toLocaleString("en-IN")} pages
          </summary>
          {item.sample.length ? (
            <ul style={{ margin: "6px 0 0", paddingLeft: 20, overflowWrap: "anywhere" }}>
              {item.sample.map((url) => (
                <li key={url}>{url}</li>
              ))}
              {item.count > item.sample.length ? <li>and {(item.count - item.sample.length).toLocaleString("en-IN")} more</li> : null}
            </ul>
          ) : (
            <p className="adm-field-help">Nothing listed.</p>
          )}
        </details>
      ))}
    </section>
  );
}

export function WhyIndexable() {
  const [url, setUrl] = useState("");
  const [answer, setAnswer] = useState<{ indexable: boolean; reasons: string[]; href: string; label: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();

  function ask() {
    setError("");
    setAnswer(null);
    start(async () => {
      const out = await explainUrlAction(url);
      if (out.ok) setAnswer({ indexable: out.indexable, reasons: out.reasons, href: out.editor.href, label: out.editor.label });
      else setError(out.message);
    });
  }

  return (
    <section className="adm-card" style={{ display: "grid", gap: 10 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Why is this URL indexable or not?</h2>
      <label className="adm-field">
        <span className="adm-field-label">Page address</span>
        <input className="adm-input" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="/jobs/pune/" />
      </label>
      <div>
        <button type="button" className="adm-btn" onClick={ask} disabled={busy || !url.trim()}>
          {busy ? "Checking..." : "Explain"}
        </button>
      </div>
      {error ? <p className="adm-field-error">{error}</p> : null}
      {answer ? (
        <div>
          <p style={{ margin: 0, fontWeight: 700 }}>{answer.indexable ? "Indexable" : "Not indexable"}</p>
          <ul style={{ margin: "6px 0 8px", paddingLeft: 20 }}>
            {answer.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <Link href={answer.href} className="adm-link">
            {answer.label}
          </Link>
        </div>
      ) : null}
    </section>
  );
}

export function IndexNowBox({ keySet, log }: { keySet: boolean; log: LogRow[] }) {
  const [urls, setUrls] = useState("");
  const [result, setResult] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [rows, setRows] = useState(log);
  const [busy, start] = useTransition();

  function submit() {
    start(async () => {
      const out = await submitIndexNowAction(urls);
      if (out.ok) {
        setResult({ kind: "info", text: `${out.urls} address${out.urls === 1 ? "" : "es"}: ${out.note}` });
        setRows((current) => [{ at: new Date().toISOString(), urls: out.urls, sent: out.sent, note: out.note }, ...current].slice(0, 20));
      } else {
        setResult({ kind: "error", text: out.fields.urls?.[0] ?? out.message });
      }
    });
  }

  return (
    <section className="adm-card" style={{ display: "grid", gap: 10 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>IndexNow</h2>
      <p className="adm-field-help" style={{ margin: 0 }}>
        Tell search engines about new or changed pages. {keySet ? "The IndexNow key is set." : "The IndexNow key is not set on this server, so a submit is only logged and nothing is sent."}
      </p>
      <label className="adm-field">
        <span className="adm-field-label">Addresses, one per line (up to 100)</span>
        <textarea className="adm-input" rows={4} value={urls} onChange={(event) => setUrls(event.target.value)} placeholder="/jobs/pune/" />
      </label>
      <div>
        <button type="button" className="adm-btn" onClick={submit} disabled={busy || !urls.trim()}>
          {busy ? "Submitting..." : "Submit"}
        </button>
      </div>
      {result ? <Notice kind={result.kind}>{result.text}</Notice> : null}
      {rows.length ? (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Addresses</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.at}-${row.urls}`}>
                  <td>{new Date(row.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td>{row.urls}</td>
                  <td>{row.sent ? "Sent" : row.note || "Not sent"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
