"use client";

import Link from "next/link";
import { safeHref } from "@/lib/sanitize";

type Cat = { slug: string; name: string };
type City = { slug: string; name: string };
type LinkItem = { label: string; href: string };

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
  const nav = links.length
    ? links
    : [
        { label: "About", href: "/about/" },
        { label: "Help centre", href: "/help/" },
        { label: "Blog", href: "/blog/" },
        { label: "Submit a report", href: "/submit-report/" },
        { label: "How to report a scam", href: "/help/scams/" },
        { label: "Terms", href: "/terms/" },
        { label: "Privacy", href: "/privacy/" },
        { label: "Cookies", href: "/cookies/" },
        { label: "Grievance officer", href: "/grievance/" },
      ];
  const nets = social.length
    ? social
    : ["Instagram", "X", "TikTok", "Bluesky", "YouTube", "Facebook"].map((label) => ({
        label,
        href: `https://www.google.com/search?q=${siteName}+${label}`,
      }));
  const top = cities.slice(0, 5);

  return (
    <footer className="mt-10 bg-white">
      <div className="container-site py-8">
        <p className="text-[13px] leading-6 text-[#555]">{about}</p>
        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {categories.map((cat) => (
            <div key={cat.slug}>
              <Link href={`/${cat.slug}/`} className="font-bold text-[#222] no-underline hover:underline">
                {cat.name}
              </Link>
              <p className="mt-2 text-[13px] leading-6">
                {top.map((city, i) => (
                  <span key={city.slug}>
                    {i > 0 ? " " : null}
                    <Link href={`/${cat.slug}/${city.slug}/`}>{city.name}</Link>
                  </span>
                ))}{" "}
                <Link href={`/${cat.slug}/`}>All cities</Link>
              </p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-[#777]">
          {nets
            .map((s) => ({ ...s, href: safeHref(s.href) }))
            .filter((s) => s.href)
            .map((s) => (
              <a key={s.label} href={s.href} rel="nofollow noopener noreferrer">
                {s.label}
              </a>
            ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 border-t border-[#eee] pt-4 text-[12px] text-[#777]">
          {nav.map((l) => (
            <Link key={l.href} href={safeHref(l.href) || "/"}>
              {l.label}
            </Link>
          ))}
          <Link href="/cities/">{cityCount} cities</Link>
          <Link href="/u/post-insert/">Do you want to advertise?</Link>
          <span>© {new Date().getFullYear()} {legalName}</span>
          <button type="button" className="ml-auto underline" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            Back to top
          </button>
        </div>
      </div>
    </footer>
  );
}
