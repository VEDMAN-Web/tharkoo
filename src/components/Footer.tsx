"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { safeHref } from "@/lib/sanitize";
import { Logo } from "./Logo";
import { IconButton } from "./ui/IconButton";

type Cat = { slug: string; name: string };
type City = { slug: string; name: string };
type LinkItem = { label: string; href: string };

function realSocial(items: LinkItem[]) {
  return items
    .map((item) => ({ ...item, href: safeHref(item.href) }))
    .filter((item) => item.href && !/google\.com\/search/i.test(item.href));
}

export function Footer({
  siteName,
  legalName,
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
  const [top, setTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setTop(window.scrollY > 800);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const socials = realSocial(social);
  const extra = links
    .map((item) => ({ ...item, href: safeHref(item.href) }))
    .filter((item) => item.href);

  return (
    <footer className="mt-12 border-t border-[color:var(--gold-line)]">
      <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-4 py-12 md:px-6 lg:grid-cols-4 lg:px-8">
        <div>
          <h2 className="t-overline mb-3">Explore</h2>
          <div className="grid gap-2">
            {categories.map((cat) => (
              <Link key={cat.slug} href={`/${cat.slug}/`} prefetch={false} className="t-small text-muted">
                {cat.name}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="t-overline mb-3">Top cities</h2>
          <div className="grid gap-2">
            {cities.map((city) => (
              <Link key={city.slug} href="/cities/" prefetch={false} className="t-small text-muted">
                {city.name}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="t-overline mb-3">Company</h2>
          <div className="grid gap-2">
            <Link href="/cms/about/" prefetch={false} className="t-small text-muted">About</Link>
            <Link href="/help/" prefetch={false} className="t-small text-muted">Help</Link>
            <Link href="/blog/" prefetch={false} className="t-small text-muted">Blog</Link>
            <Link href="/contact/" prefetch={false} className="t-small text-muted">Contact</Link>
          </div>
        </div>
        <div>
          <h2 className="t-overline mb-3">Trust and legal</h2>
          <div className="grid gap-2">
            <Link href="/cms/terms/" prefetch={false} className="t-small text-muted">Terms</Link>
            <Link href="/cms/privacy/" prefetch={false} className="t-small text-muted">Privacy</Link>
            <Link href="/cms/cookies/" prefetch={false} className="t-small text-muted">Cookies</Link>
            <Link href="/cms/grievance/" prefetch={false} className="t-small text-muted">Grievance</Link>
            <Link href="/scam-report/" prefetch={false} className="t-small text-muted">Scam report</Link>
          </div>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-4 pb-8 md:px-6 lg:px-8">
        <Logo name={siteName} href={null} />
        {socials.length ? (
          <div className="flex flex-wrap gap-3">
            {socials.map((item) => (
              <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" className="t-caption text-muted">
                {item.label}
              </a>
            ))}
          </div>
        ) : null}
        {extra.length ? (
          <div className="flex flex-wrap gap-3">
            {extra.map((item) => (
              <Link key={item.href} href={item.href || "/"} prefetch={false} className="t-caption text-muted">
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}
        <p className="t-caption text-muted">
          Copyright {new Date().getFullYear()} {legalName || siteName}
        </p>
      </div>
      {top ? (
        <div className="fixed bottom-6 right-4 z-30">
          <IconButton label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <ArrowUp />
          </IconButton>
        </div>
      ) : null}
    </footer>
  );
}
