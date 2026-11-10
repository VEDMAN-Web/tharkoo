"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { safeHref } from "@/lib/sanitize";

type LinkItem = { label: string; href: string };

function realSocial(items: LinkItem[]) {
  return items
    .map((item) => ({ ...item, href: safeHref(item.href) }))
    .filter((item) => item.href && !/google\.com\/search/i.test(item.href));
}

export function Footer({
  siteName,
  legalName,
  cityCount,
  social,
  content,
}: {
  siteName: string;
  legalName: string;
  cityCount: number;
  about?: string;
  categories?: { slug: string; name: string }[];
  cities?: { slug: string; name: string }[];
  links?: LinkItem[];
  social: LinkItem[];
  content?: {
    about?: string;
    badge?: string;
    columns?: { title: string; visible?: boolean; links: LinkItem[] }[];
    boostTitle?: string;
    postLabel?: string;
    countriesLabel?: string;
    countryOption?: string;
    copyright?: string;
    backToTop?: string;
  };
}) {
  const [top, setTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setTop(window.scrollY > 300);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const socials = realSocial(social);
  const about = (content?.about || "Tharkoo is a classifieds platform for people in India. Browse new listings every day in {count} cities.").split("{count}");
  const columns = content?.columns || [
    { title: "Legal", links: [{ label: "Terms and Conditions", href: "/terms/" }, { label: "Privacy Policy", href: "/privacy/" }, { label: "Cookie Policy", href: "/cookies/" }] },
    { title: "Support", links: [{ label: "Help Center", href: "/help/" }, { label: "Submit a Report", href: "/submit-report/" }, { label: "Blog", href: "/blog/" }] },
    { title: "Security", links: [{ label: "How to report a scam", href: "/scam-report/" }] },
    { title: "Company", links: [{ label: "About Tharkoo", href: "/cms/about/" }, { label: "Contact us", href: "/contact/" }] },
  ];
  return (
    <footer className="tk-footer" data-tk="footer">
      <div className="tk-container">
        <div className="tk-footer-brand">
          <div>
            <Logo name={siteName} href={null} country="India" />
            <span className="tk-badge-18">{content?.badge || "18+ ONLY"}</span>
          </div>
          <p className="tk-about">
            {about.length > 1 ? (
              <>
                {about[0]}
                <strong>{cityCount}</strong>
                {about.slice(1).join("{count}")}
              </>
            ) : (
              about[0]
            )}
          </p>
        </div>
        <div className="tk-foot-cols">
          {columns.filter((column) => column.visible !== false).map((column) => (
            <div key={column.title}>
              <h2>{column.title}</h2>
              {column.links.filter((item) => safeHref(item.href)).map((item) => (
                <Link key={item.href + item.label} href={safeHref(item.href)} prefetch={false}>{item.label}</Link>
              ))}
            </div>
          ))}
        </div>
        <div className="tk-foot-boost">
          <div>
            <h2>{content?.boostTitle || "Boost your visibility"}</h2>
            <Link href="/u/post-insert/" data-tk="post-ad" className="tk-btn tk-btn-primary" prefetch={false}>
              {content?.postLabel || "POST YOUR AD"}
            </Link>
          </div>
          <div>
            <h2>{content?.countriesLabel || "Countries"}</h2>
            <label className="sr-only" htmlFor="tk-country">{content?.countriesLabel || "Countries"}</label>
            <select id="tk-country" className="tk-country" defaultValue="IN" aria-label={content?.countriesLabel || "Countries"}>
              <option value="IN">{content?.countryOption || "🇮🇳 India"}</option>
            </select>
          </div>
        </div>
        <p className="tk-legal-line">{legalName}</p>
      </div>
      <div className="tk-bar">
        {socials.length ? (
          <div className="tk-socials">
            {socials.map((item) => (
              <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" aria-label={item.label}>
                {item.label}
              </a>
            ))}
          </div>
        ) : null}
        <p className="tk-copy">{content?.copyright || "Copyright 2026 © Tharkoo"}</p>
        {top ? (
          <button type="button" className="tk-top" data-tk="back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            {content?.backToTop || "Back to top ↑"}
          </button>
        ) : null}
      </div>
    </footer>
  );
}
