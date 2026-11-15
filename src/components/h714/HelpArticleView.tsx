import Link from "next/link";
import { H714Page } from "./H714Page";
import { Prose } from "@/components/ui/Prose";

export type RelatedArticle = { title: string; href: string };

export function HelpArticleView({
  helpRoot,
  section,
  title,
  updatedLabel,
  readLabel,
  related,
  body,
  contactHref,
}: {
  helpRoot: string;
  section: string;
  title: string;
  updatedLabel: string;
  readLabel: string;
  related: RelatedArticle[];
  body: string;
  contactHref: string;
}) {
  return (
    <H714Page>
        {" "}
        <section className="h714-pad" style={{ maxWidth: "1280px", margin: "0 auto", padding: "22px 24px 0", boxSizing: "border-box" }}>
          <div className="h714-band" style={{ borderRadius: "20px", padding: "30px 32px", background: "linear-gradient(120deg, rgba(255,240,247,.9), rgba(245,240,255,.9) 55%, rgba(255,248,236,.9))", border: "1px solid rgba(255,255,255,.95)", boxShadow: "0 8px 32px rgba(45,18,72,.07)" }}>
            <nav aria-label="Breadcrumb" style={{ fontSize: "13px", color: "#6B4A8A", marginBottom: "10px" }}>
              <Link href={helpRoot} style={{ textDecoration: "none" }}>Help</Link>
              {" "}
              <span aria-hidden="true">/</span>
              {" "}
              <span style={{ textDecoration: "none" }}>{section}</span>
              {" "}
              <span aria-hidden="true">/</span>
              {" "}{title}
            </nav>
            <h1 className="h714-h1" style={{ margin: "0 0 6px", fontSize: "38px", letterSpacing: "-.03em", color: "#110520" }}>{title}</h1>
            <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.55", color: "#4A2870", maxWidth: "640px" }}></p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#5B21B6", background: "rgba(255,255,255,.85)", borderRadius: "999px", padding: "6px 12px" }}>{section}</span>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#5B21B6", background: "rgba(255,255,255,.85)", borderRadius: "999px", padding: "6px 12px" }}>{updatedLabel}</span>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#5B21B6", background: "rgba(255,255,255,.85)", borderRadius: "999px", padding: "6px 12px" }}>{readLabel}</span>
            </div>
          </div>
        </section>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px 24px 0", boxSizing: "border-box" }} className="h714-2l h714-pad">
          <aside className="h714-aside-static h714-hide-xs" style={{ position: "sticky", top: "92px", borderRadius: "20px", background: "rgba(255,255,255,.78)", backdropFilter: "blur(18px) saturate(170%)", WebkitBackdropFilter: "blur(18px) saturate(170%)", border: "1px solid rgba(255,255,255,.95)", boxShadow: "0 8px 32px rgba(45,18,72,.08)", overflow: "hidden" }}>
            <p style={{ margin: "0", padding: "16px 18px", fontSize: "12px", fontWeight: "800", letterSpacing: ".12em", textTransform: "uppercase", color: "#6B4A8A", borderBottom: "1px solid #F3E8F7", background: "linear-gradient(135deg, rgba(255,240,247,.9), rgba(245,240,255,.9))" }}>{section || "Help"}</p>
            <nav style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "2px" }}>
              {related.map((item) => (
                <Link key={item.href} href={item.href} style={{ display: "flex", alignItems: "center", minHeight: "42px", padding: "0 14px", borderRadius: "12px", fontSize: "14px", textDecoration: "none", background: "#FDF0F7", color: "#A8124F", fontWeight: "700" }}>{item.title}</Link>
              ))}
            </nav>
          </aside>
          <article className="h714-art" style={{ padding: "32px 36px", borderRadius: "20px", background: "#fff", border: "1px solid #EAD8F0", boxShadow: "0 2px 14px rgba(45,18,72,.07)", maxWidth: "760px" }}>
            <Prose className="whitespace-pre-wrap">{body}</Prose>
            {" "}
            <div style={{ marginTop: "30px", padding: "18px 20px", borderRadius: "16px", background: "#FDF6FB", border: "1px solid #F3E8F7", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "15px", fontWeight: "600", color: "#3B1F55" }}>Was this helpful?</span>
              <Link href={contactHref} className="h714-b" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "48px", padding: "0 24px", borderRadius: "999px", background: "linear-gradient(135deg, #D1137A, #A8124F)", color: "#fff", fontWeight: "700", textDecoration: "none", boxShadow: "0 8px 24px rgba(209,19,122,.3)", fontSize: "15px" }}>Contact us</Link>
            </div>
          </article>
        </div>
        {" "}
    </H714Page>
  );
}
