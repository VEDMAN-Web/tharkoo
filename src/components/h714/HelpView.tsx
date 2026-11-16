import Link from "next/link";
import { H714Page } from "./H714Page";

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
          <div className="h714-band" style={{ borderRadius: "20px", padding: "30px 32px", background: "linear-gradient(120deg, rgba(255,240,247,.9), rgba(245,240,255,.9) 55%, rgba(255,248,236,.9))", border: "1px solid rgba(255,255,255,.95)", boxShadow: "0 8px 32px rgba(45,18,72,.07)" }}>
            <nav aria-label="Breadcrumb" style={{ fontSize: "13px", color: "#6B4A8A", marginBottom: "10px" }}>
              <Link href="/" style={{ textDecoration: "none" }}>Tharkoo India</Link>
              {" "}
              <span aria-hidden="true">/</span>
              {" "}Help
            </nav>
            <h1 className="h714-h1" style={{ margin: "0 0 6px", fontSize: "38px", letterSpacing: "-.03em", color: "#110520" }}>How can we help?</h1>
            <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.55", color: "#4A2870", maxWidth: "640px" }}>Search the help articles or pick a topic below.</p>
            <form role="search" action={helpHref} method="get" style={{ marginTop: "18px", padding: "8px", borderRadius: "16px", background: "rgba(255,255,255,.8)", border: "1px solid rgba(255,255,255,.95)", boxShadow: "0 8px 24px rgba(45,18,72,.08)", display: "flex", gap: "8px", flexWrap: "wrap", maxWidth: "680px" }}>
              <label style={{ flex: "1 1 220px", display: "flex", alignItems: "center", gap: "10px", minHeight: "48px", padding: "0 14px", borderRadius: "12px", background: "#fff", border: "1.5px solid #EAD8F0" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B4A8A" strokeWidth="2" aria-hidden="true">
                  <circle cx="11" cy="11" r="7"></circle>
                  <path d="M20 20l-4-4"></path>
                </svg>
                <span style={{ position: "absolute", left: "-9999px" }}>Search help, e.g. edit my ad</span>
                <input name="q" defaultValue={query} placeholder="Search help, e.g. edit my ad" style={{ border: "0", outline: "none", font: "inherit", fontSize: "15px", width: "100%", background: "transparent" }} />
              </label>
              <button type="submit" className="h714-b" style={{ minHeight: "48px", padding: "0 24px", border: "0", borderRadius: "12px", background: "linear-gradient(135deg, #D1137A, #A8124F)", color: "#fff", fontWeight: "700", textDecoration: "none", boxShadow: "0 8px 24px rgba(209,19,122,.3)", font: "inherit", cursor: "pointer" }}>Search</button>
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
        <section className="h714-pad" style={{ maxWidth: "1280px", margin: "0 auto", padding: "64px 24px 0", boxSizing: "border-box" }}>
          <div className="h714-2r">
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: "16px", flexWrap: "wrap", marginBottom: "26px" }}>
                <div>
                  <p style={{ display: "inline-block", margin: "0 0 10px", fontSize: "12px", fontWeight: "700", letterSpacing: ".12em", textTransform: "uppercase", color: "#5B21B6", background: "#F5F0FF", borderRadius: "999px", padding: "6px 14px" }}>Popular</p>
                  <h2 className="h714-h2" style={{ margin: "0", fontSize: "40px", letterSpacing: "-.035em", lineHeight: "1.1", color: "#110520" }}>{popularHeading}</h2>
                </div>
              </div>
              <div style={{ borderRadius: "20px", overflow: "hidden", background: "rgba(255,255,255,.78)", backdropFilter: "blur(18px) saturate(170%)", WebkitBackdropFilter: "blur(18px) saturate(170%)", border: "1px solid rgba(255,255,255,.95)", boxShadow: "0 8px 32px rgba(45,18,72,.08)" }}>
              {popular.map((row) => (
                    <Link key={row.href} href={row.href} className="h714-row-link" style={{ display: "flex", alignItems: "center", gap: "12px", minHeight: "58px", padding: "0 22px", borderTop: "0", textDecoration: "none", color: "#110520", fontSize: "15px", fontWeight: "600" }}>
                      <span style={{ flex: "1" }}>{row.title}</span>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C2185B" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9 6l6 6-6 6"></path>
                      </svg>
                    </Link>
              ))}
              </div>
            </div>
            <div style={{ paddingTop: "8px" }}>
              <div style={{ padding: "24px", borderRadius: "20px", background: "rgba(255,255,255,.78)", backdropFilter: "blur(18px) saturate(170%)", WebkitBackdropFilter: "blur(18px) saturate(170%)", border: "1px solid rgba(255,255,255,.95)", boxShadow: "0 8px 32px rgba(45,18,72,.08)" }}>
                <p style={{ display: "inline-block", margin: "0 0 10px", fontSize: "12px", fontWeight: "700", letterSpacing: ".12em", textTransform: "uppercase", color: "#C2185B", background: "#FDF0F7", borderRadius: "999px", padding: "6px 14px" }}>Still stuck?</p>
                <h3 style={{ margin: "0 0 6px", fontSize: "22px", color: "#110520" }}>Talk to our team</h3>
                <p style={{ margin: "0 0 18px", fontSize: "15px", lineHeight: "1.6", color: "#4A2870" }}>We usually reply in about 10 minutes, 9 am to 9 pm.</p>
                {" "}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <Link href={chatHref} className="h714-b" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "48px", padding: "0 24px", borderRadius: "999px", background: "linear-gradient(135deg, #D1137A, #A8124F)", color: "#fff", fontWeight: "700", textDecoration: "none", boxShadow: "0 8px 24px rgba(209,19,122,.3)", fontSize: "15px", width: "100%", boxSizing: "border-box" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 5h16v11H8l-4 4z"></path>
                    </svg>
                    Chat with us
                  </Link>
                  <Link href={whatsappHref} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "48px", borderRadius: "999px", background: "linear-gradient(135deg, #F0FDF4, #DCFCE7)", color: "#15803D", fontSize: "15px", fontWeight: "700", textDecoration: "none" }}>WhatsApp</Link>
                  <Link href={telegramHref} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "48px", borderRadius: "999px", background: "linear-gradient(135deg, #F0F9FF, #E0F2FE)", color: "#0369A1", fontSize: "15px", fontWeight: "700", textDecoration: "none" }}>Telegram</Link>
                  <Link href={contactHref} style={{ textAlign: "center", fontSize: "14px", fontWeight: "700", paddingTop: "4px" }}>Send us a message</Link>
                </div>
              </div>
            </div>
          </div>
        </section>
        {" "}
    </H714Page>
  );
}
