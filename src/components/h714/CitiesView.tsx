import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { H714Page } from "./H714Page";

export type CityCard = { slug: string; name: string; summary: string; href: string; photo: string };
export type StateCard = { slug: string; name: string; anchor: string; adsLabel: string; allLabel: string; href: string; cities: CityCard[] };
export type StateLetter = { letter: string; href: string };

const CARD_STYLE: CSSProperties = { padding: "20px", borderRadius: "16px", border: "1px solid #EAD8F0", boxShadow: "0 2px 14px rgba(45,18,72,.07)" };
const CARD_BACKGROUNDS = ["linear-gradient(135deg, #FFF0F7, #FFFFFF)", "linear-gradient(135deg, #F5F0FF, #FFFFFF)", "linear-gradient(135deg, #FFF8EC, #FFFFFF)", "linear-gradient(135deg, #F0FDF4, #FFFFFF)", "linear-gradient(135deg, #F0F9FF, #FFFFFF)", "linear-gradient(135deg, #FFF0F7, #FFFFFF)"];
const HEAD_STYLE: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "10px" };
const H3_STYLE: CSSProperties = { margin: "0", fontSize: "18px", color: "#110520" };
const COUNT_STYLE: CSSProperties = { fontSize: "12px", fontWeight: "700", color: "#C2185B", background: "#FDF0F7", borderRadius: "999px", padding: "3px 10px" };
const CHIPS_STYLE: CSSProperties = { display: "flex", gap: "6px", flexWrap: "wrap", margin: "14px 0 16px" };
const CITY_CHIP_STYLE: CSSProperties = { minHeight: "34px", display: "inline-flex", alignItems: "center", padding: "0 14px", borderRadius: "999px", background: "#fff", border: "1px solid #EAD8F0", color: "#4A2870", fontSize: "13px", fontWeight: "600", textDecoration: "none" };
const ALL_STYLE: CSSProperties = { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: "700", textDecoration: "none" };
const LETTER_STYLE: CSSProperties = { width: "36px", height: "36px", borderRadius: "10px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700", textDecoration: "none", flex: "none", background: "rgba(255,255,255,.85)", border: "1px solid #EAD8F0", color: "#4A2870" };
const LETTERS_STYLE: CSSProperties = { marginBottom: "22px" };

export function CitiesView({
  bandIntro,
  bandChips,
  topCities,
  states,
  stateLetters,
  searchHref,
  children,
}: {
  bandIntro: string;
  bandChips: CityCard[];
  topCities: CityCard[];
  states: StateCard[];
  stateLetters: StateLetter[];
  searchHref: string;
  children?: ReactNode;
}) {
  return (
    <H714Page>
        {" "}
        <section className="h714-pad" style={{ maxWidth: "1280px", margin: "0 auto", padding: "22px 24px 0", boxSizing: "border-box" }}>
          <div className="h714-band" style={{ borderRadius: "20px", padding: "30px 32px", background: "linear-gradient(120deg, rgba(255,240,247,.9), rgba(245,240,255,.9) 55%, rgba(255,248,236,.9))", border: "1px solid rgba(255,255,255,.95)", boxShadow: "0 8px 32px rgba(45,18,72,.07)" }}>
            <nav aria-label="Breadcrumb" style={{ fontSize: "13px", color: "#6B4A8A", marginBottom: "10px" }}>
              <Link href="/" style={{ textDecoration: "none" }}>Tharkoo India</Link>
              {" "}
              <span aria-hidden="true">/</span>
              {" "}Cities
            </nav>
            <h1 className="h714-h1" style={{ margin: "0 0 6px", fontSize: "38px", letterSpacing: "-.03em", color: "#110520" }}>Cities and areas in India</h1>
            <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.55", color: "#4A2870", maxWidth: "640px" }}>{bandIntro}</p>
            <form role="search" action={searchHref} method="get" style={{ marginTop: "18px", padding: "8px", borderRadius: "16px", background: "rgba(255,255,255,.8)", border: "1px solid rgba(255,255,255,.95)", boxShadow: "0 8px 24px rgba(45,18,72,.08)", display: "flex", gap: "8px", flexWrap: "wrap", maxWidth: "760px" }}>
              <label style={{ flex: "1 1 220px", display: "flex", alignItems: "center", gap: "10px", minHeight: "48px", padding: "0 14px", borderRadius: "12px", background: "#fff", border: "1.5px solid #EAD8F0" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B4A8A" strokeWidth="2" aria-hidden="true">
                  <circle cx="11" cy="11" r="7"></circle>
                  <path d="M20 20l-4-4"></path>
                </svg>
                <span style={{ position: "absolute", left: "-9999px" }}>Type a city or area, e.g. Vesu, Surat</span>
                <input name="q" placeholder="Type a city or area, e.g. Vesu, Surat" style={{ border: "0", outline: "none", font: "inherit", fontSize: "15px", width: "100%", background: "transparent" }} />
              </label>
              <button type="submit" className="h714-b" style={{ minHeight: "48px", padding: "0 24px", border: "0", borderRadius: "12px", background: "linear-gradient(135deg, #D1137A, #A8124F)", color: "#fff", fontWeight: "700", textDecoration: "none", boxShadow: "0 8px 24px rgba(209,19,122,.3)", font: "inherit", cursor: "pointer" }}>Search</button>
            </form>
            <div className="h714-chips" style={{ marginTop: "18px" }}>
                {bandChips.map((city) => (
                <Link key={city.slug} href={city.href} style={{ minHeight: "38px", display: "inline-flex", alignItems: "center", padding: "0 16px", borderRadius: "999px", background: "rgba(255,255,255,.8)", border: "1px solid #EAD8F0", color: "#4A2870", fontSize: "13px", fontWeight: "600", textDecoration: "none", whiteSpace: "nowrap" }}>{city.name}</Link>
                ))}
            </div>
          </div>
        </section>
        <section className="h714-pad" style={{ maxWidth: "1280px", margin: "0 auto", padding: "56px 24px 0", boxSizing: "border-box" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: "16px", flexWrap: "wrap", marginBottom: "26px" }}>
            <div>
              <p style={{ display: "inline-block", margin: "0 0 10px", fontSize: "12px", fontWeight: "700", letterSpacing: ".12em", textTransform: "uppercase", color: "#5B21B6", background: "#F5F0FF", borderRadius: "999px", padding: "6px 14px" }}>Popular</p>
              <h2 className="h714-h2" style={{ margin: "0", fontSize: "40px", letterSpacing: "-.035em", lineHeight: "1.1", color: "#110520" }}>Top cities</h2>
            </div>
          </div>
          <div className="h714-g4">
              {topCities.map((city) => (
                <Link key={city.slug} href={city.href} className="h714-cat" style={{ display: "flex", flexDirection: "column", borderRadius: "16px", overflow: "hidden", background: "#fff", border: "1px solid #EAD8F0", textDecoration: "none", boxShadow: "0 2px 14px rgba(45,18,72,.07)" }}>
                  {" "}
                  <span className="h714-catimg" style={{ ...(city.photo ? { backgroundImage: `url("${city.photo}")`, backgroundSize: "cover", backgroundPosition: "center" } : {}), position: "relative", display: "block", background: "linear-gradient(145deg, #ECFDF5, #E0F2FE)" }}>
                    <span style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", fontSize: "11px", fontWeight: "600", color: "rgba(30,11,56,.4)", whiteSpace: "nowrap" }}>{city.photo ? "" : "City photo"}</span>
                  </span>
                  {" "}
                  <span style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", background: "linear-gradient(135deg, #F0FDF4, #FFFFFF)" }}>
                    <span style={{ flex: "1", minWidth: "0" }}>
                      <span style={{ display: "block", fontSize: "16px", fontWeight: "700", color: "#110520" }}>{city.name}</span>
                      <span style={{ display: "block", fontSize: "12px", color: "#4A2870", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{city.summary}</span>
                    </span>
                    {" "}
                    <span style={{ width: "36px", height: "36px", flex: "none", borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(45,18,72,.08)" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C2185B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12h14M13 6l6 6-6 6"></path>
                      </svg>
                    </span>
                  </span>
                </Link>
              ))}
            </div>
        </section>
        <section className="h714-pad" style={{ maxWidth: "1280px", margin: "0 auto", padding: "64px 24px 0", boxSizing: "border-box" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: "16px", flexWrap: "wrap", marginBottom: "26px" }}>
            <div>
              <p style={{ display: "inline-block", margin: "0 0 10px", fontSize: "12px", fontWeight: "700", letterSpacing: ".12em", textTransform: "uppercase", color: "#5B21B6", background: "#F5F0FF", borderRadius: "999px", padding: "6px 14px" }}>Browse by state</p>
              <h2 className="h714-h2" style={{ margin: "0", fontSize: "40px", letterSpacing: "-.035em", lineHeight: "1.1", color: "#110520" }}>All states A to Z</h2>
            </div>
          </div>
              <div className="h714-chips" style={LETTERS_STYLE}>
                {stateLetters.map((letter) => (
                  <Link key={letter.letter} href={letter.href} style={LETTER_STYLE}>
                    {letter.letter}
                  </Link>
                ))}
              </div>
              <div className="h714-g3">
                {states.map((state, index) => (
                  <div key={state.slug} id={state.anchor} className="h714-card" style={{ ...CARD_STYLE, background: CARD_BACKGROUNDS[index % CARD_BACKGROUNDS.length] }}>
                    <div style={HEAD_STYLE}>
                      <h3 style={H3_STYLE}>{state.name}</h3>
                      <span style={COUNT_STYLE}>{state.adsLabel}</span>
                    </div>
                    <div style={CHIPS_STYLE}>
                      {state.cities.map((city) => (
                        <Link key={city.slug} href={city.href} style={CITY_CHIP_STYLE}>
                          {city.name}
                        </Link>
                      ))}
                    </div>
                    <Link href={state.href} style={ALL_STYLE}>
                      {state.allLabel}{" "}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C2185B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12h14M13 6l6 6-6 6"></path>
                      </svg>
                    </Link>
                  </div>
                ))}
              </div>
        </section>
        {" "}
      {children}
    </H714Page>
  );
}
