"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getFooterCountries } from "@/server/locations/footer-action";
import type { DirectoryCountry } from "@/server/locations/countries";
import { useUrlPaths } from "./UrlPaths";
import { applyPrefixes, countryPath, placePath } from "@/lib/urls";

const countStyle = { color: "var(--muted)", fontSize: 12, marginLeft: "auto", paddingLeft: 8 } as const;
const rowStyle = { display: "flex", alignItems: "center", gap: 8, minHeight: 28, fontSize: 14 } as const;

/** Footer "Countries" block: flag, name, live ad count, expandable to cities. Shows nothing until there is a live ad. */
export function FooterCountries({ title, allLabel, categorySlug }: { title?: string; allLabel?: string; categorySlug: string }) {
  const paths = useUrlPaths();
  const [rows, setRows] = useState<DirectoryCountry[]>([]);
  useEffect(() => {
    let alive = true;
    getFooterCountries()
      .then((next) => {
        if (alive) setRows(next);
      })
      .catch(() => {
        if (alive) setRows([]);
      });
    return () => {
      alive = false;
    };
  }, []);
  if (!rows.length || !categorySlug) return null;
  return (
    <section className="tk-foot-countries" data-tk="footer-countries" aria-label={title || "Countries"} style={{ gridColumn: "1 / -1" }}>
      <h2>{title || "Countries"}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0 20px" }}>
        {rows.map((country) => (
          <details key={country.slug} style={{ borderBottom: "1px solid var(--border)" }}>
            <summary style={{ ...rowStyle, cursor: "pointer", listStyle: "none" }}>
              <span aria-hidden>{country.flag || "🌐"}</span>
              <span style={{ fontWeight: 600 }}>{country.name}</span>
              <span style={countStyle}>{country.count}</span>
            </summary>
            <div style={{ paddingLeft: 24, paddingBottom: 6 }}>
              <Link href={countryPath(country.slug)} prefetch={false} style={{ ...rowStyle, color: "var(--primary)" }}>
                {country.name}
              </Link>
              {country.cities.map((city) => (
                <Link key={city.slug} href={applyPrefixes(placePath(categorySlug, city.slug), paths)} prefetch={false} style={rowStyle}>
                  <span>{city.name}</span>
                  <span style={countStyle}>{city.count}</span>
                </Link>
              ))}
            </div>
          </details>
        ))}
      </div>
      <Link href="/countries/" prefetch={false} style={{ ...rowStyle, color: "var(--primary)", fontWeight: 600, marginTop: 6 }}>
        {allLabel || "All countries"}
      </Link>
    </section>
  );
}
