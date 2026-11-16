"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { safeHref } from "@/lib/sanitize";
import { applyPrefixes, categoryPath } from "@/lib/urls";
import { useUrlPaths } from "./UrlPaths";
import { SUPPORT_PHONE, SUPPORT_TELEGRAM, telegramHref, whatsappHref } from "@/lib/support";
import "./FooterNew.css";
import type { ShellConfig, ShellContact, ShellLink } from "@/server/site-links/shell-config-rules";

type Cat = { slug: string; name: string };

/** P1 / H7.10: the six social squares, always shown in this order. The admin link is used when it has one, else "#". */
const SOCIALS: { name: string; text: string; bg: string; fg: string; fallback?: string }[] = [
  { name: "WhatsApp", text: "WA", bg: "#DCFCE7", fg: "#15803D", fallback: whatsappHref(SUPPORT_PHONE) },
  { name: "X", text: "X", bg: "#F3F4F6", fg: "#111827" },
  { name: "LinkedIn", text: "in", bg: "#DBEAFE", fg: "#1D4ED8" },
  { name: "Instagram", text: "IG", bg: "#FCE7F3", fg: "#BE185D" },
  { name: "Pinterest", text: "P", bg: "#FEE2E2", fg: "#B91C1C" },
  { name: "Telegram", text: "TG", bg: "#E0F2FE", fg: "#0369A1", fallback: telegramHref(SUPPORT_TELEGRAM) },
];

/**
 * P1 / H7.10: the three get-in-touch rows, always shown. The admin value is used when set; an empty value shows the
 * mockup placeholder and links to "#". A Telegram row is matched by its kind or, for older rows, by its label.
 */
const CONTACT_ROWS: {
  label: string;
  text: string;
  bg: string;
  fg: string;
  placeholder: string;
  hrefFor: (value: string) => string;
  match: (contact: ShellContact) => boolean;
}[] = [
  { label: "WhatsApp", text: "WA", bg: "#DCFCE7", fg: "#15803D", placeholder: SUPPORT_PHONE, hrefFor: whatsappHref, match: (c) => c.kind === "whatsapp" },
  { label: "Telegram", text: "TG", bg: "#E0F2FE", fg: "#0369A1", placeholder: SUPPORT_TELEGRAM, hrefFor: telegramHref, match: (c) => c.kind === "telegram" || /telegram/i.test(c.label) },
  { label: "Email", text: "@", bg: "#FCE7F3", fg: "#BE185D", placeholder: "[YOUR SUPPORT EMAIL]", hrefFor: () => "", match: (c) => c.kind === "email" },
];

function LinkColumn({ title, items, columns }: { title: string; items: ShellLink[]; columns: 1 | 2 }) {
  const paths = useUrlPaths();
  const shown = items.filter((item) => item.visible && item.label);
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
 * H7.1 / P1 / H7.10: the one footer on every public page when the New design is on, as the mockup. Nothing is hidden:
 * the six socials, the three get-in-touch rows and the address always show. An empty admin value shows the placeholder
 * and links to "#". All other text comes from the shell config.
 */
export function FooterNew({ siteName, shell, categories }: { siteName: string; shell: ShellConfig; categories: Cat[] }) {
  const paths = useUrlPaths();
  const f = shell.footer;
  const topCategories: ShellLink[] = f.topCategories.length
    ? f.topCategories
    : categories.slice(0, 6).map((cat) => ({ label: cat.name, href: categoryPath(cat.slug), visible: true, icon: "tag" as const }));
  const adminLink = (name: string) => f.socials.find((item) => item.visible && item.label.trim().toLowerCase() === name.toLowerCase());
  return (
    <footer className="tkn-footer" data-tk="footer">
      <div className="tkn-wrap tkn-foot-grid">
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
          <ul className="tkn-socials" aria-label="Social links">
            {SOCIALS.map((social) => {
              const link = adminLink(social.name);
              const href = (link && safeHref(link.href)) || social.fallback || "#";
              return (
                <li key={social.name}>
                  <a
                    href={href}
                    target={href === "#" ? undefined : "_blank"}
                    rel={href === "#" ? undefined : "noopener noreferrer"}
                    className="tkn-social"
                    aria-label={`${social.text} ${social.name}`}
                    style={{ "--sb": social.bg, "--sf": social.fg } as CSSProperties}
                  >
                    {social.text}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
        <LinkColumn title="Quick links" items={f.quickLinks} columns={2} />
        <LinkColumn title="Top categories" items={topCategories} columns={1} />
        <div className="tkn-foot-col">
          <p className="tkn-foot-title"><span aria-hidden="true" className="tkn-foot-dot" />Get in touch</p>
          <ul className="tkn-contacts">
            {CONTACT_ROWS.map((row) => {
              const contact = f.contacts.find((item) => item.visible && item.value && row.match(item));
              const value = contact?.value || row.placeholder;
              const href = (contact && safeHref(contact.href)) || row.hrefFor(value) || "#";
              return (
                <li key={row.label}>
                  <a href={href} className="tkn-contact">
                    <span className="tkn-contact-tile" aria-hidden="true" style={{ "--sb": row.bg, "--sf": row.fg } as CSSProperties}>
                      {row.text}
                    </span>
                    <span className="tkn-contact-text">
                      <span className="tkn-contact-label">{row.label}:</span> <span className="tkn-contact-value">{value}</span>
                    </span>
                    <ArrowRight size={16} aria-hidden="true" focusable="false" className="tkn-contact-arrow" />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className="tkn-bar">
        <div className="tkn-wrap tkn-bar-row">
          <p className="tkn-copy">
            {f.copyright}
            {f.adultNotice ? <span className="tkn-adult"> · {f.adultNotice}</span> : null}
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
