import { createElement } from "react";
import Image from "next/image";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { categoryIconFor } from "@/lib/category-icons";
import { H714Page } from "./H714Page";

export type CategoryCard = { slug: string; name: string; icon?: string; summary: string; href: string; photo: string; photoFocus?: string };

function CategoryIcon({ icon }: { icon?: string }) {
  return (
    <span className="tk-block-icon" aria-hidden="true">
      {createElement(categoryIconFor(icon, ""), { size: 20 })}
    </span>
  );
}

export function CategoriesView({
  categories,
  searchHref,
  postAdHref,
}: {
  categories: CategoryCard[];
  searchHref: string;
  postAdHref: string;
}) {
  // The hint uses the first real category names, so it always matches the cards below.
  const examples = categories.slice(0, 3).map((category) => category.name).join(", ");
  const hint = examples ? `Find a category, e.g. ${examples}` : "Find a category";
  return (
    <H714Page>
        {" "}
        <section className="h714-pad" style={{ maxWidth: "1280px", margin: "0 auto", padding: "22px 24px 0", boxSizing: "border-box" }}>
          <div className="h714-band" style={{ borderRadius: "20px", padding: "30px 32px", background: "linear-gradient(120deg, rgba(255,240,247,.9), rgba(245,240,255,.9) 55%, rgba(255,248,236,.9))", border: "1px solid rgba(255,255,255,.95)", boxShadow: "0 8px 32px rgba(45,18,72,.07)" }}>
            <nav aria-label="Breadcrumb" style={{ fontSize: "13px", color: "#6B4A8A", marginBottom: "10px" }}>
              <Link href="/" style={{ textDecoration: "none" }}>Tharkoo India</Link>
              {" "}
              <span aria-hidden="true">/</span>
              {" "}Categories
            </nav>
            <h1 className="h714-h1" style={{ margin: "0 0 6px", fontSize: "38px", letterSpacing: "-.03em", color: "#110520" }}>All categories</h1>
            <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.55", color: "#4A2870", maxWidth: "640px" }}>Pick a category to see fresh ads near you.</p>
            <form role="search" className="h714-search" action={searchHref} method="get" style={{ marginTop: "18px", padding: "8px", borderRadius: "16px", background: "rgba(255,255,255,.8)", border: "1px solid rgba(255,255,255,.95)", boxShadow: "0 8px 24px rgba(45,18,72,.08)", display: "flex", gap: "8px", flexWrap: "wrap", maxWidth: "760px" }}>
              <label style={{ flex: "1 1 220px", display: "flex", alignItems: "center", gap: "10px", minHeight: "48px", padding: "0 14px", borderRadius: "12px", background: "#fff", border: "1.5px solid #EAD8F0" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B4A8A" strokeWidth="2" aria-hidden="true">
                  <circle cx="11" cy="11" r="7"></circle>
                  <path d="M20 20l-4-4"></path>
                </svg>
                <span style={{ position: "absolute", left: "-9999px" }}>{hint}</span>
                <input name="q" placeholder={hint} style={{ border: "0", outline: "none", font: "inherit", fontSize: "15px", width: "100%", background: "transparent" }} />
              </label>
              <button type="submit" className="h714-b h714-search-go" style={{ minHeight: "48px", padding: "0 24px", border: "0", borderRadius: "12px", background: "linear-gradient(135deg, #D1137A, #A8124F)", color: "#fff", fontWeight: "700", textDecoration: "none", boxShadow: "0 8px 24px rgba(209,19,122,.3)", font: "inherit", cursor: "pointer" }}>Search</button>
            </form>
            <div className="h714-chips" style={{ marginTop: "18px" }}>
              <Link href="/categories/" aria-current="page" style={{ minHeight: "38px", display: "inline-flex", alignItems: "center", padding: "0 16px", borderRadius: "999px", background: "#A8124F", color: "#fff", fontSize: "13px", fontWeight: "700", textDecoration: "none", whiteSpace: "nowrap" }}>All</Link>
              <Link href={`${searchHref}?q=${encodeURIComponent("People and social")}`} style={{ minHeight: "38px", display: "inline-flex", alignItems: "center", padding: "0 16px", borderRadius: "999px", background: "rgba(255,255,255,.8)", border: "1px solid #EAD8F0", color: "#4A2870", fontSize: "13px", fontWeight: "600", textDecoration: "none", whiteSpace: "nowrap" }}>People and social</Link>
              <Link href={`${searchHref}?q=${encodeURIComponent("Home and living")}`} style={{ minHeight: "38px", display: "inline-flex", alignItems: "center", padding: "0 16px", borderRadius: "999px", background: "rgba(255,255,255,.8)", border: "1px solid #EAD8F0", color: "#4A2870", fontSize: "13px", fontWeight: "600", textDecoration: "none", whiteSpace: "nowrap" }}>Home and living</Link>
              <Link href={`${searchHref}?q=${encodeURIComponent("Jobs and learning")}`} style={{ minHeight: "38px", display: "inline-flex", alignItems: "center", padding: "0 16px", borderRadius: "999px", background: "rgba(255,255,255,.8)", border: "1px solid #EAD8F0", color: "#4A2870", fontSize: "13px", fontWeight: "600", textDecoration: "none", whiteSpace: "nowrap" }}>Jobs and learning</Link>
              <Link href={`${searchHref}?q=${encodeURIComponent("Buy and sell")}`} style={{ minHeight: "38px", display: "inline-flex", alignItems: "center", padding: "0 16px", borderRadius: "999px", background: "rgba(255,255,255,.8)", border: "1px solid #EAD8F0", color: "#4A2870", fontSize: "13px", fontWeight: "600", textDecoration: "none", whiteSpace: "nowrap" }}>Buy and sell</Link>
            </div>
          </div>
        </section>
        <section className="h714-pad" style={{ maxWidth: "1280px", margin: "0 auto", padding: "28px 24px 0", boxSizing: "border-box" }}>
          <div className="h714-g4">
              {categories.map((cat) => (
                <Link key={cat.slug} href={cat.href} className="h714-cat" style={{ background: "#fff", border: "1px solid #EAD8F0", boxShadow: "0 2px 14px rgba(45,18,72,.07)" }}>
                  {cat.photo ? (
                    <span className="h714-catimg" style={{ position: "relative", display: "block", background: "linear-gradient(145deg, #FCE4F0, #EDE9FF)" }}>
                      <Image src={cat.photo} alt="" fill sizes="(max-width: 600px) 50vw, 25vw" unoptimized className="h714-photo" style={cat.photoFocus ? { objectPosition: cat.photoFocus } : undefined} />
                    </span>
                  ) : (
                    <span className="h714-catico" style={{ background: "linear-gradient(145deg, #FCE4F0, #EDE9FF)" }}>
                      <CategoryIcon icon={cat.icon} />
                    </span>
                  )}
                  <span className="h714-catbody" style={{ background: "linear-gradient(135deg, #FFF0F7, #FFFFFF)" }}>
                    <span className="h714-cattext">
                      <span className="h714-name">{cat.name}</span>
                      <span className="h714-desc">{cat.summary}</span>
                    </span>
                    <span className="h714-arrow">
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
          <div style={{ position: "relative", overflow: "hidden", borderRadius: "22px", padding: "30px 32px", background: "linear-gradient(120deg, #FFF0F7, #F5F0FF 55%, #FFF8EC)", border: "1.5px solid #F0C6DE", boxShadow: "0 14px 40px rgba(168,18,79,.12), inset 0 1px 0 rgba(255,255,255,.9)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "18px", flexWrap: "wrap" }}>
            <span aria-hidden="true" style={{ position: "absolute", right: "-60px", top: "-80px", width: "240px", height: "240px", borderRadius: "50%", background: "radial-gradient(circle, rgba(233,30,140,.16), rgba(233,30,140,0) 70%)", pointerEvents: "none" }}></span>
            <span aria-hidden="true" style={{ position: "absolute", left: "-70px", bottom: "-110px", width: "260px", height: "260px", borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,.14), rgba(124,58,237,0) 70%)", pointerEvents: "none" }}></span>
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "16px" }}>
              <span aria-hidden="true" style={{ flex: "none", width: "52px", height: "52px", display: "grid", placeItems: "center", borderRadius: "16px", background: "#fff", color: "#C2185B", border: "1.5px solid #F0C6DE", boxShadow: "0 8px 20px -8px rgba(209,19,122,.45)" }}>
                <Megaphone size={24} />
              </span>
              <div>
                <h2 className="h714-h2" style={{ margin: "0 0 6px", fontSize: "30px", letterSpacing: "-.03em", color: "#110520" }}>Have something to offer?</h2>
                <p style={{ margin: "0", fontSize: "15px", color: "#4A2870" }}>Post your ad in about 2 minutes.</p>
              </div>
            </div>
            <div style={{ position: "relative", display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <Link href={postAdHref} className="h714-b" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "48px", padding: "0 24px", borderRadius: "999px", background: "linear-gradient(135deg, #D1137A, #A8124F)", color: "#fff", fontWeight: "700", textDecoration: "none", boxShadow: "0 8px 24px rgba(209,19,122,.3)", fontSize: "15px" }}>Post your ad</Link>
              <Link href="/how-it-works/" className="h714-b" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "48px", padding: "0 24px", borderRadius: "999px", border: "1.5px solid #EAD8F0", background: "rgba(255,255,255,.85)", color: "#4A2870", fontWeight: "700", fontSize: "15px", textDecoration: "none" }}>How it works</Link>
            </div>
          </div>
        </section>
        {" "}
    </H714Page>
  );
}
