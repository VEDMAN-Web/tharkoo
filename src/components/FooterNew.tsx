"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "./BrandLogo";
import { LOGO_LIGHT_DEFAULT } from "@/lib/brand";
import { ArrowRight, BadgeCheck, ChevronRight, Lock, Mail, Sparkles } from "lucide-react";
import { safeHref } from "@/lib/sanitize";
import { applyPrefixes, categoriesPath, categoryPath } from "@/lib/urls";
import { SUPPORT_EMAIL, mailtoHref, telegramHref, whatsappHref } from "@/lib/support";
import { useUrlPaths } from "./UrlPaths";
import { useT } from "./help/UiTextProvider";
import { BrandMark, type BrandName } from "./BrandMarks";
import "./FooterNew.css";
import type { ShellConfig, ShellContact, ShellLink } from "@/server/site-links/shell-config-rules";

type Cat = { slug: string; name: string };

/** H17.14: WhatsApp and Telegram have no stand-in: when the admin screen has no number or handle, the icon and the row are not drawn. */
const SOCIALS: { name: string; brand: BrandName; color: string; fill: string; fallback: string }[] = [
  { name: "WhatsApp", brand: "whatsapp", color: "#25D366", fill: "#25D366", fallback: "" },
  { name: "X", brand: "x", color: "#000000", fill: "#000000", fallback: "" },
  { name: "LinkedIn", brand: "linkedin", color: "#0A66C2", fill: "#0A66C2", fallback: "" },
  { name: "Instagram", brand: "instagram", color: "#DD2A7B", fill: "linear-gradient(45deg, #F58529, #DD2A7B 45%, #8134AF 75%, #515BD4)", fallback: "" },
  { name: "Pinterest", brand: "pinterest", color: "#E60023", fill: "#E60023", fallback: "" },
  { name: "Telegram", brand: "telegram", color: "#26A5E4", fill: "#26A5E4", fallback: "" },
];
const ADMIN_ONLY = new Set(["WhatsApp", "Telegram"]);

const TRUST_STYLES = [
  { tone: "blue", icon: BadgeCheck },
  { tone: "violet", icon: Lock },
  { tone: "pink", icon: Sparkles },
] as const;

const CONTACT_ROWS: {
  label: string;
  tint: string;
  accent: string;
  fallback: string;
  hrefFor: (value: string) => string;
  icon: ReactNode;
  match: (contact: ShellContact) => boolean;
}[] = [
  {
    label: "WhatsApp",
    tint: "#E9FBF0",
    accent: "#25D366",
    fallback: "",
    hrefFor: whatsappHref,
    icon: <BrandMark name="whatsapp" size={22} color="#25D366" />,
    match: (c) => c.kind === "whatsapp",
  },
  {
    label: "Telegram",
    tint: "#E8F6FD",
    accent: "#26A5E4",
    fallback: "",
    hrefFor: telegramHref,
    icon: <BrandMark name="telegram" size={22} color="#26A5E4" />,
    match: (c) => c.kind === "telegram" || /telegram/i.test(c.label),
  },
  {
    label: "Email",
    tint: "#FDE7F2",
    accent: "#E91E8C",
    fallback: SUPPORT_EMAIL,
    hrefFor: mailtoHref,
    icon: <Mail size={22} color="#C2185B" aria-hidden="true" focusable="false" />,
    match: (c) => c.kind === "email",
  },
];

/** H17.14: Terms, Privacy and Grievance Officer are always in the bottom row (words from Site text); the admin list adds the rest. */
const LEGAL_PATHS = ["/terms/", "/privacy/", "/grievance/", "/grievance-officer/", "/cms/grievance/"];

function footerLegalLinks(legal: ShellLink[], t: (key: "chrome.footer.terms" | "chrome.footer.privacy" | "chrome.footer.grievance") => string): ShellLink[] {
  const fixed: ShellLink[] = [
    { label: t("chrome.footer.terms"), href: "/terms/", visible: true, icon: "shield" },
    { label: t("chrome.footer.privacy"), href: "/privacy/", visible: true, icon: "shield" },
    { label: t("chrome.footer.grievance"), href: "/grievance/", visible: true, icon: "user" },
  ];
  const extra = legal.filter((item) => item.visible && safeHref(item.href) && !LEGAL_PATHS.includes(item.href.trim().replace(/\/?$/, "/")));
  return [...fixed, ...extra];
}

function LinkColumn({ title, items, className, extra }: { title: string; items: ShellLink[]; className: string; extra?: ShellLink }) {
  const paths = useUrlPaths();
  const shown = items.filter((item) => item.visible && item.label);
  return (
    <nav aria-label={title} className={`tkn-foot-col ${className}`}>
      <p className="tkn-foot-title"><span aria-hidden="true" className="tkn-foot-dot" />{title}</p>
      <ul className="tkn-foot-links">
        {shown.map((item) => {
          const href = safeHref(item.href);
          return (
            <li key={item.label + item.href}>
              {href ? (
                <Link href={applyPrefixes(href, paths)} prefetch={false}>
                  <ChevronRight className="tkn-foot-chev" size={14} aria-hidden="true" focusable="false" />
                  {item.label}
                </Link>
              ) : (
                <span>{item.label}</span>
              )}
            </li>
          );
        })}
        {extra ? (
          <li>
            <Link href={applyPrefixes(extra.href, paths)} prefetch={false} className="tkn-foot-all">
              {extra.label}
              <ArrowRight size={14} aria-hidden="true" focusable="false" />
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

export function FooterNew({ siteName, logo = LOGO_LIGHT_DEFAULT, shell, categories }: { siteName: string; logo?: string; shell: ShellConfig; categories: Cat[] }) {
  const paths = useUrlPaths();
  const t = useT();
  const f = shell.footer;
  const topCategories: ShellLink[] = f.topCategories.length
    ? f.topCategories
    : categories.slice(0, 6).map((cat) => ({ label: cat.name, href: categoryPath(cat.slug), visible: true, icon: "tag" as const }));
  const allCategories: ShellLink = { label: t("chrome.footer.all"), href: categoriesPath(), visible: true, icon: "grid" };
  const adminLink = (name: string) => f.socials.find((item) => item.visible && item.label.trim().toLowerCase() === name.toLowerCase());
  const legalLinks = footerLegalLinks(f.legal, t);
  return (
    <footer className="tkn-footer" data-tk="footer">
      <div className="tkn-wrap tkn-foot-grid">
        <div className="tkn-foot-brand">
          <BrandLogo src={logo} name={siteName} height={40} />
          <p className="tkn-foot-about">{f.about}</p>
          {f.trust.length ? (
            <ul className="tkn-pills" aria-label={t("chrome.footer.trust")}>
              {f.trust.map((text, index) => {
                const style = TRUST_STYLES[index % TRUST_STYLES.length];
                const Icon = style.icon;
                return (
                  <li key={text} className={`tkn-pill tkn-pill-${style.tone}`}>
                    <Icon size={14} aria-hidden="true" focusable="false" />
                    {text}
                  </li>
                );
              })}
            </ul>
          ) : null}
          <ul className="tkn-socials" aria-label={t("chrome.footer.social")}>
            {SOCIALS.map((social) => {
              const link = adminLink(social.name);
              const href = (link && safeHref(link.href)) || social.fallback;
              const style = { "--sc": social.color, "--sf": social.fill } as CSSProperties;
              if (!href && ADMIN_ONLY.has(social.name)) return null;
              return (
                <li key={social.name}>
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="tkn-social" aria-label={`Tharkoo on ${social.name}`} style={style}>
                      <BrandMark name={social.brand} />
                    </a>
                  ) : (
                    <span className="tkn-social tkn-social-off" role="img" aria-label={`Tharkoo on ${social.name}`} style={style}>
                      <BrandMark name={social.brand} />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        <LinkColumn title={t("chrome.footer.quick")} items={f.quickLinks} className="tkn-foot-quick" />
        <LinkColumn title={t("chrome.footer.top")} items={topCategories} className="tkn-foot-top" extra={allCategories} />
        <div className="tkn-foot-col tkn-foot-touch">
          <p className="tkn-foot-title"><span aria-hidden="true" className="tkn-foot-dot" />{t("chrome.footer.touch")}</p>
          <ul className="tkn-contacts">
            {CONTACT_ROWS.map((row) => {
              const contact = f.contacts.find((item) => item.visible && item.value && !item.value.startsWith("[") && row.match(item));
              const value = contact?.value || row.fallback;
              if (!value) return null;
              const href = (contact && safeHref(contact.href)) || row.hrefFor(value);
              const style = { "--cb": row.tint, "--ca": row.accent } as CSSProperties;
              const body = (
                <>
                  <span className="tkn-contact-tile" aria-hidden="true">{row.icon}</span>
                  <span className="tkn-contact-text">
                    <span className="tkn-contact-label">{row.label}</span>
                    <span className="tkn-contact-value">{value}</span>
                  </span>
                  {href ? <ArrowRight size={16} aria-hidden="true" focusable="false" className="tkn-contact-arrow" /> : null}
                </>
              );
              return (
                <li key={row.label}>
                  {href ? <a href={href} className="tkn-contact" style={style}>{body}</a> : <div className="tkn-contact" style={style}>{body}</div>}
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
          <nav aria-label={t("chrome.footer.legal")}>
            <ul className="tkn-legal">
              {legalLinks.map((item) => (
                <li key={item.label + item.href}>
                  <Link href={applyPrefixes(safeHref(item.href), paths)} prefetch={false} className="tkn-pill tkn-legal-pill">{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
