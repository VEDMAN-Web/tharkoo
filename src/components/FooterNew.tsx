"use client";

import Link from "next/link";
import { MessageCircle, Phone, Clock, MapPin, Mail, ArrowRight } from "lucide-react";
import { safeHref } from "@/lib/sanitize";
import { applyPrefixes, categoryPath } from "@/lib/urls";
import { useUrlPaths } from "./UrlPaths";
import "./FooterNew.css";
import type { ContactKind, ShellConfig, ShellLink } from "@/server/site-links/shell-config-rules";

type Cat = { slug: string; name: string };

const CONTACT_ICON: Record<ContactKind, typeof Mail> = {
  email: Mail,
  phone: Phone,
  whatsapp: MessageCircle,
  hours: Clock,
  address: MapPin,
};

function LinkColumn({ title, items }: { title: string; items: ShellLink[] }) {
  const paths = useUrlPaths();
  const shown = items.filter((item) => item.visible && item.label);
  if (!shown.length) return null;
  return (
    <nav aria-label={title} className="tkn-foot-col">
      <p className="tkn-foot-title"><span aria-hidden="true" className="tkn-foot-dot" />{title}</p>
      <ul className="tkn-foot-links">
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
 * H7.1: the one footer on every public page when the New design is on: brand block, trust pills, socials,
 * quick links, top categories, contact rows and the legal row. All text comes from the shell config.
 */
export function FooterNew({ siteName, shell, categories }: { siteName: string; shell: ShellConfig; categories: Cat[] }) {
  const paths = useUrlPaths();
  const f = shell.footer;
  const topCategories: ShellLink[] = f.topCategories.length
    ? f.topCategories
    : categories.slice(0, 6).map((cat) => ({ label: cat.name, href: categoryPath(cat.slug), visible: true, icon: "tag" as const }));
  const socials = f.socials.filter((item) => item.visible && safeHref(item.href));
  const contacts = f.contacts.filter((item) => item.visible && (item.label || item.value));
  return (
    <footer className="tkn-footer" data-tk="footer">
      <div className={contacts.length ? "tkn-wrap tkn-foot-grid" : "tkn-wrap tkn-foot-grid is-three"}>
        <div className="tkn-foot-brand">
          <div className="tkn-brand">
            <span className="tkn-mark" aria-hidden="true">t</span>
            <span className="tkn-brand-text">
              <span className="tkn-brand-name">{siteName}</span>
              <span className="tkn-brand-tag">Free classifieds</span>
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
                return (
                  <li key={item.label + item.href}>
                    <a href={href} target="_blank" rel="noopener noreferrer" className="tkn-social" aria-label={item.label}>
                      {item.label.slice(0, 2)}
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
        <LinkColumn title="Quick links" items={f.quickLinks} />
        <LinkColumn title="Top categories" items={topCategories} />
        {contacts.length ? (
          <div className="tkn-foot-col">
            <p className="tkn-foot-title"><span aria-hidden="true" className="tkn-foot-dot" />Get in touch</p>
            <ul className="tkn-contacts">
              {contacts.map((item) => {
                const Icon = CONTACT_ICON[item.kind] ?? Mail;
                const href = safeHref(item.href);
                const body = (
                  <>
                    <Icon size={18} aria-hidden="true" focusable="false" />
                    <span>
                      <strong>{item.label}</strong>
                      {item.value ? <span className="tkn-contact-value">{item.value}</span> : null}
                    </span>
                    {href ? <ArrowRight size={16} aria-hidden="true" focusable="false" /> : null}
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
