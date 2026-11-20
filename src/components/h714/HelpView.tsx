import Link from "next/link";
import { Send } from "lucide-react";
import { SUPPORT_HOURS } from "@/lib/support";
import { H714Page } from "./H714Page";
import { BrandMark } from "@/components/BrandMarks";

export type HelpCard = { title: string; desc: string; count: string; href: string };
export type HelpRow = { title: string; href: string };
export type QuickTopic = { label: string; href: string };

export function HelpView({
  cards,
  popular,
  popularHeading,
  quickTopics,
  query,
  helpHref,
  chatHref,
  whatsappHref,
  telegramHref,
  contactHref,
}: {
  cards: HelpCard[];
  popular: HelpRow[];
  popularHeading: string;
  quickTopics: QuickTopic[];
  query: string;
  helpHref: string;
  chatHref: string;
  whatsappHref: string;
  telegramHref: string;
  contactHref: string;
}) {
  return (
    <H714Page>
        {" "}
        <section className="h714-pad" style={{ maxWidth: "1280px", margin: "0 auto", padding: "22px 24px 0", boxSizing: "border-box" }}>
          <div className="h714-band" style={{ borderRadius: "20px", padding: "30px 32px", background: "linear-gradient(120deg, rgba(255,240,247,.9), rgba(245,240,255,.9) 55%, rgba(253,246,251,.9))", border: "1px solid rgba(255,255,255,.95)", boxShadow: "0 8px 32px rgba(45,18,72,.07)" }}>
            <nav aria-label="Breadcrumb" style={{ fontSize: "13px", color: "#6B4A8A", marginBottom: "10px" }}>
              <Link href="/" style={{ textDecoration: "none" }}>Tharkoo India</Link>
              {" "}
              <span aria-hidden="true">/</span>
              {" "}Help
            </nav>
            <h1 className="h714-h1" style={{ margin: "0 0 6px", fontSize: "38px", letterSpacing: "-.03em", color: "#110520" }}>How can we help?</h1>
            <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.55", color: "#4A2870", maxWidth: "640px" }}>Search the help articles or pick a topic below.</p>
            <form role="search" className="h714-search" action={helpHref} method="get" style={{ marginTop: "18px", padding: "8px", borderRadius: "16px", background: "rgba(255,255,255,.8)", border: "1px solid rgba(255,255,255,.95)", boxShadow: "0 8px 24px rgba(45,18,72,.08)", display: "flex", gap: "8px", flexWrap: "wrap", maxWidth: "680px" }}>
              <label style={{ flex: "1 1 220px", display: "flex", alignItems: "center", gap: "10px", minHeight: "48px", padding: "0 14px", borderRadius: "12px", background: "#fff", border: "1.5px solid #EAD8F0" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B4A8A" strokeWidth="2" aria-hidden="true">
                  <circle cx="11" cy="11" r="7"></circle>
                  <path d="M20 20l-4-4"></path>
                </svg>
                <span style={{ position: "absolute", left: "-9999px" }}>Search help, e.g. edit my ad</span>
                <input name="q" defaultValue={query} placeholder="Search help, e.g. edit my ad" style={{ border: "0", outline: "none", font: "inherit", fontSize: "15px", width: "100%", background: "transparent" }} />
              </label>
              <button type="submit" className="h714-b h714-search-go" style={{ minHeight: "48px", padding: "0 24px", border: "0", borderRadius: "12px", background: "linear-gradient(135deg, #D1137A, #A8124F)", color: "#fff", fontWeight: "700", textDecoration: "none", boxShadow: "0 8px 24px rgba(209,19,122,.3)", font: "inherit", cursor: "pointer" }}>Search</button>
            </form>
            <div className="h714-chips" style={{ marginTop: "18px" }}>
                {quickTopics.map((topic) => (
                <Link key={topic.label} href={topic.href} style={{ minHeight: "38px", display: "inline-flex", alignItems: "center", padding: "0 16px", borderRadius: "999px", background: "rgba(255,255,255,.8)", border: "1px solid #EAD8F0", color: "#4A2870", fontSize: "13px", fontWeight: "600", textDecoration: "none", whiteSpace: "nowrap" }}>{topic.label}</Link>
                ))}
            </div>
          </div>
        </section>
        <section className="h714-pad" style={{ maxWidth: "1280px", margin: "0 auto", padding: "28px 24px 0", boxSizing: "border-box" }}>
          <div className="h714-g4">
              {cards.map((card) => (
                <Link key={card.href} href={card.href} className="h714-cat" style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "20px", borderRadius: "16px", background: "#fff", border: "1px solid #EAD8F0", textDecoration: "none", boxShadow: "0 2px 14px rgba(45,18,72,.07)" }}>
                  <span style={{ width: "44px", height: "44px", flex: "none", borderRadius: "12px", background: "#FDF0F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C2185B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"></path>
                    </svg></span>
                  <span>
                    <span style={{ display: "block", fontSize: "16px", fontWeight: "700", color: "#110520" }}>{card.title}</span>
                    <span style={{ display: "block", fontSize: "13px", color: "#4A2870", marginTop: "4px" }}>{card.desc}</span>
                  </span>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#C2185B" }}>{card.count}</span>
                </Link>
              ))}
            </div>
        </section>
        <section className="h714-pad h714-help" style={{ maxWidth: "1280px", margin: "0 auto", padding: "64px 24px 0", boxSizing: "border-box" }}>
          <div className="h714-help-head">
            <p className="h714-eyebrow h714-eyebrow-violet">Popular</p>
            <h2 className="h714-h2">{popularHeading}</h2>
          </div>
          <div className="h714-help-grid">
            <div className="h714-help-list">
              {popular.map((row) => (
                <Link key={row.href} href={row.href} className="h714-row-link">
                  <span>{row.title}</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C2185B" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 6l6 6-6 6"></path>
                  </svg>
                </Link>
              ))}
            </div>
            <aside className="h714-help-card" aria-labelledby="h714-help-team">
              <p className="h714-eyebrow h714-eyebrow-pink">Still stuck?</p>
              <h3 id="h714-help-team" className="h714-help-title">Talk to our team</h3>
              <p className="h714-help-sub">Support hours {SUPPORT_HOURS}. We reply by chat or email.</p>
              <div className="h714-help-actions">
                <Link href={chatHref} className="h714-btn h714-btn-primary">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 5h16v11H8l-4 4z"></path>
                  </svg>
                  Chat with us
                </Link>
                {whatsappHref ? (
                  <Link href={whatsappHref} className="h714-btn h714-btn-wa">
                    <BrandMark name="whatsapp" size={20} />
                    WhatsApp
                  </Link>
                ) : null}
                {telegramHref ? (
                  <Link href={telegramHref} className="h714-btn h714-btn-tg">
                    <Send size={18} aria-hidden="true" focusable="false" />
                    Telegram
                  </Link>
                ) : null}
                <Link href={contactHref} className="h714-btn h714-btn-ghost">Send us a message</Link>
              </div>
            </aside>
          </div>
        </section>
        {" "}
    </H714Page>
  );
}
