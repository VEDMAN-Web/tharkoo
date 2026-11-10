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
}: {
  siteName: string;
  legalName: string;
  cityCount: number;
  about?: string;
  categories?: { slug: string; name: string }[];
  cities?: { slug: string; name: string }[];
  links?: LinkItem[];
  social: LinkItem[];
}) {
  const [top, setTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setTop(window.scrollY > 300);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const socials = realSocial(social);
  return (
    <footer className="tk-footer" data-tk="footer">
      <div className="tk-container">
        <div className="tk-footer-brand">
          <div>
            <Logo name={siteName} href={null} country="India" />
            <span className="tk-badge-18">18+ ONLY</span>
          </div>
          <p className="tk-about">
            Tharkoo is a classifieds platform for people in India. Browse new listings every day in <strong>{cityCount}</strong> cities.
          </p>
        </div>
        <div className="tk-foot-cols">
          <div>
            <h2>Legal</h2>
            <Link href="/terms/" prefetch={false}>Terms and Conditions</Link>
            <Link href="/privacy/" prefetch={false}>Privacy Policy</Link>
            <Link href="/cookies/" prefetch={false}>Cookie Policy</Link>
          </div>
          <div>
            <h2>Support</h2>
            <Link href="/help/" prefetch={false}>Help Center</Link>
            <Link href="/submit-report/" prefetch={false}>Submit a Report</Link>
            <Link href="/blog/" prefetch={false}>Blog</Link>
          </div>
          <div>
            <h2>Security</h2>
            <Link href="/scam-report/" prefetch={false}>How to report a scam</Link>
          </div>
          <div>
            <h2>Company</h2>
            <Link href="/cms/about/" prefetch={false}>About Tharkoo</Link>
            <Link href="/contact/" prefetch={false}>Contact us</Link>
          </div>
        </div>
        <div className="tk-foot-boost">
          <div>
            <h2>Boost your visibility</h2>
            <Link href="/u/post-insert/" data-tk="post-ad" className="tk-btn tk-btn-primary" prefetch={false}>
              POST YOUR AD
            </Link>
          </div>
          <div>
            <h2>Countries</h2>
            <label className="sr-only" htmlFor="tk-country">Countries</label>
            <select id="tk-country" className="tk-country" defaultValue="IN" aria-label="Countries">
              <option value="IN">🇮🇳 India</option>
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
        <p className="tk-copy">Copyright 2026 © Tharkoo</p>
        {top ? (
          <button type="button" className="tk-top" data-tk="back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            Back to top ↑
          </button>
        ) : null}
      </div>
    </footer>
  );
}
