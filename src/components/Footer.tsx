"use client";

import Link from "next/link";
import { Logo } from "./Logo";
import { safeHref } from "@/lib/sanitize";

type Cat = { slug: string; name: string };
type City = { slug: string; name: string };
type LinkItem = { label: string; href: string };

const PILL_CITIES = ["bangalore", "hyderabad", "delhi", "pune", "mumbai"];

export function Footer({
  siteName,
  legalName,
  cityCount,
  about,
  categories,
  cities,
  links,
  social,
}: {
  siteName: string;
  legalName: string;
  cityCount: number;
  about: string;
  categories: Cat[];
  cities: City[];
  links: LinkItem[];
  social: LinkItem[];
}) {
  const bySlug = Object.fromEntries(cities.map((c) => [c.slug, c]));
  const pills = PILL_CITIES.map((slug) => bySlug[slug]).filter(Boolean);
  const socialItems = social.length
    ? social
    : [
        { label: "Instagram", href: "https://www.instagram.com/" },
        { label: "X", href: "https://x.com/" },
        { label: "TikTok", href: "https://www.tiktok.com/" },
        { label: "Bluesky", href: "https://bsky.app/" },
      ];

  return (
    <>
      <div className="sk-container footer-city-wrap">
        <hr className="sk-hr" />
        <div className="footer-city">
          {categories.map((cat, i) => (
            <div key={cat.slug} className="footer-city-card">
              <div className="footer-city-head">
                <Link href={`/${cat.slug}/`} className="h4 no-underline">
                  {cat.name}
                </Link>
              </div>
              <div className="footer-city-pills">
                {pills.map((city) => (
                  <Link key={city.slug} href={`/${cat.slug}/${city.slug}/`} className="no-underline">
                    <span className="button-pill">{city.name}</span>
                  </Link>
                ))}
                {i === 0 ? (
                  <Link href="/cities/" className="no-underline">
                    <span className="button-pill">All cities</span>
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
      <footer className="sk-footer">
        <div className="sk-container">
          <hr className="sk-hr" />
          <div className="footer-top">
            <div>
              <Logo name={siteName} />
              <div className="rta-badge">
                <strong>RTA</strong>
                <span>RESTRICTED TO ADULTS</span>
              </div>
            </div>
            <p className="footer-about">
              {about ||
                `${siteName} is the largest advertising platform for independent escorts worldwide. Browse through thousands of new ads from hot escorts around the world.`}
            </p>
          </div>
          <div className="footer-cols">
            <div>
              <h5>Legal</h5>
              <Link href="/terms/">Terms and Conditions</Link>
              <Link href="/privacy/">Privacy Policy</Link>
              <Link href="/cookies/">Cookie Policy</Link>
            </div>
            <div>
              <h5>Support</h5>
              <Link href="/help/">Help Center</Link>
              <Link href="/submit-report/">Submit a Report</Link>
              <Link href="/blog/">Blog</Link>
            </div>
            <div>
              <h5>Security</h5>
              <Link href="/help/scams/">How to report a scam</Link>
            </div>
            <div>
              <h5>Company</h5>
              <Link href="/about/">About</Link>
              <Link href="/grievance/">Grievance officer</Link>
              <Link href="/cities/">{cityCount} cities</Link>
            </div>
          </div>
          <div className="footer-boost">
            <div>
              <h6>Boost your visibility</h6>
              <Link href="/u/post-insert/" className="btn-post btn-block">
                Post your ad
              </Link>
            </div>
            <div>
              <h6>Countries</h6>
              <select className="country-select" defaultValue="IN" aria-label="Country">
                <option value="IN">🇮🇳 India</option>
              </select>
            </div>
          </div>
          {links.length ? (
            <p className="footer-extra">
              {links.map((l) => (
                <Link key={l.href} href={safeHref(l.href) || "/"}>
                  {l.label}
                </Link>
              ))}
            </p>
          ) : null}
        </div>
        <div className="social-section">
          <div className="sk-container social-inner">
            <div className="social-links">
              {socialItems
                .map((s) => ({ ...s, href: safeHref(s.href) }))
                .filter((s) => s.href)
                .map((s) => (
                  <a key={s.label} href={s.href} rel="nofollow noopener noreferrer" className="text-white">
                    {s.label}
                  </a>
                ))}
            </div>
            <div className="copyright">
              <small>
                Copyright {new Date().getFullYear()} © {legalName || siteName}
              </small>
            </div>
            <button type="button" className="back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              Back to top
            </button>
          </div>
        </div>
      </footer>
    </>
  );
}
