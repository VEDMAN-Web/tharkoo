"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { safeHref } from "@/lib/sanitize";
import { applyPrefixes, categoryPath } from "@/lib/urls";
import { useUrlPaths } from "./UrlPaths";
import "./FooterNew.css";
import type { ShellConfig, ShellLink, ShellContact } from "@/server/site-links/shell-config-rules";

type Cat = { slug: string; name: string };

/** P1: the mockup's social squares (short text and colours), matched by the admin label. Other labels get a neutral square. */
const SOCIAL_STYLE: Record<string, { text: string; bg: string; fg: string }> = {
  whatsapp: { text: "WA", bg: "#DCFCE7", fg: "#15803D" },
  x: { text: "X", bg: "#F3F4F6", fg: "#111827" },
  linkedin: { text: "in", bg: "#DBEAFE", fg: "#1D4ED8" },
  instagram: { text: "IG", bg: "#FCE7F3", fg: "#BE185D" },
  pinterest: { text: "P", bg: "#FEE2E2", fg: "#B91C1C" },
  telegram: { text: "TG", bg: "#E0F2FE", fg: "#0369A1" },
};

/** P1: the coloured tile of each contact row (the mockup's WA, TG and @). */
const CONTACT_TILE: Record<ShellContact["kind"], { text: string; bg: string; fg: string }> = {
  whatsapp: { text: "WA", bg: "#DCFCE7", fg: "#15803D" },
  email: { text: "@", bg: "#FCE7F3", fg: "#BE185D" },
  phone: { text: "Ph", bg: "#EDE9FF", fg: "#5B21B6" },
  hours: { text: "Hr", bg: "#FFF5E6", fg: "#92400E" },
  address: { text: "Ad", bg: "#E0F2FE", fg: "#0369A1" },
};

function socialStyle(label: string) {
  return SOCIAL_STYLE[label.trim().toLowerCase()] ?? { text: label.slice(0, 2), bg: "#F3F4F6", fg: "#4A2870" };
}

function LinkColumn({ title, items, columns }: { title: string; items: ShellLink[]; columns: 1 | 2 }) {
  const paths = useUrlPaths();
  const shown = items.filter((item) => item.visible && item.label);
  if (!shown.length) return null;
  return (
    <nav aria-label={title} className="tkn-foot-col">
      <p className="tkn-foot-title"><span aria-hidden="true" className="tkn-foot-dot" />{title}</p>
      <ul className={columns === 2 ? "tkn-foot-links tkn-foot-links-2" : "tkn-foot-links tkn-foot-links-1"}>
        {shown.map((item) => {
          const href = safeHref(item.href);
          return (
            <li key={item.label + item.href}>
              {href ? <Link href={applyPrefixes(href, paths)} prefetch={false}>{item.label}</Link> : <span>{item.label}</span>}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * H7.1 / P1: the one footer on every public page when the New design is on, as the mockup: brand block, trust pills,
 * socials, quick links (2 columns), top categories (1 column), get in touch rows and the legal row.
 * All text comes from the shell config. A social square or contact row with no link or value is not shown.
 */
export function FooterNew({ siteName, shell, categories }: { siteName: string; shell: ShellConfig; categories: Cat[] }) {
  const paths = useUrlPaths();
  const f = shell.footer;
  const topCategories: ShellLink[] = f.topCategories.length
    ? f.topCategories
    : categories.slice(0, 6).map((cat) => ({ label: cat.name, href: categoryPath(cat.slug), visible: true, icon: "tag" as const }));
  const socials = f.socials.filter((item) => item.visible && safeHref(item.href)).slice(0, 6);
  const contacts = f.contacts.filter((item) => item.visible && item.value);
  const address = f.contacts.find((item) => item.kind === "address" && item.visible && item.value);
  return (
    <footer className="tkn-footer" data-tk="footer">
      <div className={contacts.length ? "tkn-wrap tkn-foot-grid" : "tkn-wrap tkn-foot-grid is-three"}>
        <div className="tkn-foot-brand">
          <div className="tkn-brand">
            <span className="tkn-mark" aria-hidden="true">t</span>
            <span className="tkn-brand-text">
              <span className="tkn-brand-name">{siteName.toLowerCase()}</span>
              <span className="tkn-foot-tagline">FREE CLASSIFIEDS &amp; DATING</span>
            </span>
          </div>
          <p className="tkn-foot-about">{f.about}</p>
          {f.trust.length ? (
            <ul className="tkn-pills" aria-label="Trust">
              {f.trust.map((text) => <li key={text} className="tkn-pill">{text}</li>)}
            </ul>
          ) : null}
          {socials.length ? (
            <ul className="tkn-socials" aria-label="Social links">
              {socials.map((item) => {
                const href = safeHref(item.href);
                const style = socialStyle(item.label);
                return (
                  <li key={item.label + item.href}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tkn-social"
                      aria-label={item.label}
                      style={{ "--sb": style.bg, "--sf": style.fg } as CSSProperties}
                    >
                      {style.text}
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
        <LinkColumn title="Quick links" items={f.quickLinks} columns={2} />
        <LinkColumn title="Top categories" items={topCategories} columns={1} />
        {contacts.length ? (
          <div className="tkn-foot-col">
            <p className="tkn-foot-title"><span aria-hidden="true" className="tkn-foot-dot" />Get in touch</p>
            <ul className="tkn-contacts">
              {contacts.map((item) => {
                const tile = CONTACT_TILE[item.kind] ?? CONTACT_TILE.email;
                const href = safeHref(item.href);
                const body = (
                  <>
                    <span className="tkn-contact-tile" aria-hidden="true" style={{ "--sb": tile.bg, "--sf": tile.fg } as CSSProperties}>
                      {tile.text}
                    </span>
                    <span className="tkn-contact-text">
                      <span className="tkn-contact-label">{item.label}:</span> <span className="tkn-contact-value">{item.value}</span>
                    </span>
                    {href ? <ArrowRight size={16} aria-hidden="true" focusable="false" className="tkn-contact-arrow" /> : null}
                  </>
                );
                return (
                  <li key={item.label + item.value}>
                    {href ? <a href={href} className="tkn-contact">{body}</a> : <span className="tkn-contact">{body}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="tkn-bar">
        <div className="tkn-wrap tkn-bar-row">
          <p className="tkn-copy">
            {f.copyright}
            {f.adultNotice ? <span className="tkn-adult"> · {f.adultNotice}</span> : null}
            {address ? <span> · {address.value}</span> : null}
          </p>
          <nav aria-label="Legal">
            <ul className="tkn-legal">
              {f.legal.filter((item) => item.visible && safeHref(item.href)).map((item) => (
                <li key={item.label + item.href}>
                  <Link href={applyPrefixes(safeHref(item.href), paths)} prefetch={false} className="tkn-pill">{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
