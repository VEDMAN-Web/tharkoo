"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import type { FormEvent } from "react";
import { useUrlPaths } from "@/components/UrlPaths";
import { helpPath } from "@/lib/urls";
import type { TextFn } from "@/lib/ui/text";

export type ChatArticle = { slug: string; title: string; section: string };

export type ChatLine =
  | { id: number; kind: "text"; from: "you" | "support"; text: string }
  | { id: number; kind: "articles"; articles: ChatArticle[]; loading: boolean };

type Translate = TextFn;

export function ArticleCards({ line, t, canTalk, onTalk }: { line: Extract<ChatLine, { kind: "articles" }>; t: Translate; canTalk: boolean; onTalk: () => void }) {
  const paths = useUrlPaths();
  return (
    <div className="tkn-arts" data-tk="chat-articles">
      <p className="tkn-bubble tkn-bubble-in">
        {line.loading ? t("chat.articles.loading") : line.articles.length ? t("chat.articles.intro") : t("chat.articles.none")}
      </p>
      {line.articles.map((article) => (
        <Link key={article.slug} href={helpPath(paths, article.slug)} className="tkn-art" prefetch={false}>
          <BookOpen size={16} aria-hidden="true" focusable="false" />
          <span className="tkn-art-text">
            <strong>{article.title}</strong>
            {article.section ? <span>{article.section}</span> : null}
          </span>
        </Link>
      ))}
      {canTalk && !line.loading ? (
        <button type="button" className="tkn-btn tkn-btn-primary tkn-chat-talk" data-tk="chat-talk" onClick={onTalk}>
          {t("chat.talk")}
        </button>
      ) : null}
    </div>
  );
}

export function GuestForm({
  hint,
  t,
  value,
  error,
  busy,
  onChange,
  onSubmit,
}: {
  hint: string;
  t: Translate;
  value: { name: string; contact: string };
  error: string;
  busy: boolean;
  onChange: (next: { name: string; contact: string }) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form className="tkn-guest" data-tk="chat-guest" onSubmit={onSubmit} noValidate>
      <p className="t-small">{hint}</p>
      <label className="tkn-field">
        <span>{t("chat.guest.name")}</span>
        <input value={value.name} autoComplete="name" maxLength={80} onChange={(e) => onChange({ ...value, name: e.target.value })} />
      </label>
      <label className="tkn-field">
        <span>{t("chat.guest.contact")}</span>
        <input value={value.contact} autoComplete="email" maxLength={120} onChange={(e) => onChange({ ...value, contact: e.target.value })} />
      </label>
      {error ? <p className="tkn-error" role="alert">{error}</p> : null}
      <button type="submit" className="tkn-btn tkn-btn-primary tkn-btn-block" disabled={busy}>{t("chat.guest.send")}</button>
    </form>
  );
}
