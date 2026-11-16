import Link from "next/link";
import { H714Page } from "./H714Page";
import { FaqList, type FaqItem } from "./FaqList";

export function HowItWorksView({
  postAdHref,
  faqs,
  packsText,
}: {
  postAdHref: string;
  faqs: FaqItem[];
  packsText: string;
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
              {" "}How it works
            </nav>
            <h1 className="h714-h1" style={{ margin: "0 0 6px", fontSize: "38px", letterSpacing: "-.03em", color: "#110520" }}>How Tharkoo works</h1>
            <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.55", color: "#4A2870", maxWidth: "640px" }}>
              Find what you need, chat with the advertiser, and see it live on a video call before you meet or pay.
            </p>
            <div className="h714-chips" style={{ marginTop: "18px" }}>
              <span aria-current="page" style={{ minHeight: "38px", display: "inline-flex", alignItems: "center", padding: "0 16px", borderRadius: "999px", background: "#A8124F", color: "#fff", fontSize: "13px", fontWeight: "700", textDecoration: "none", whiteSpace: "nowrap" }}>I&apos;m looking for something</span>
              <Link href={postAdHref} style={{ minHeight: "38px", display: "inline-flex", alignItems: "center", padding: "0 16px", borderRadius: "999px", background: "rgba(255,255,255,.8)", border: "1px solid #EAD8F0", color: "#4A2870", fontSize: "13px", fontWeight: "600", textDecoration: "none", whiteSpace: "nowrap" }}>I want to post an ad</Link>
            </div>
          </div>
        </section>
        <section className="h714-pad" style={{ maxWidth: "1280px", margin: "0 auto", padding: "28px 24px 0", boxSizing: "border-box" }}>
          <div className="h714-g4b">
            <div style={{ padding: "26px", borderRadius: "20px", background: "linear-gradient(160deg, #FFF0F7, #FFFFFF)", backdropFilter: "blur(18px) saturate(170%)", WebkitBackdropFilter: "blur(18px) saturate(170%)", border: "1px solid rgba(255,255,255,.95)", boxShadow: "0 8px 32px rgba(45,18,72,.08)" }}>
              <span style={{ display: "flex", width: "48px", height: "48px", borderRadius: "14px", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: "800", color: "#fff", background: "linear-gradient(135deg, #D1137A, #A8124F)" }}>1</span>
              <h3 style={{ margin: "18px 0 8px", fontSize: "19px", color: "#110520" }}>Search near you</h3>
              <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.6", color: "#4A2870" }}>Pick your city and a category. Filter by Online now or Photo verified.</p>
            </div>
            <div style={{ padding: "26px", borderRadius: "20px", background: "linear-gradient(160deg, #F5F0FF, #FFFFFF)", backdropFilter: "blur(18px) saturate(170%)", WebkitBackdropFilter: "blur(18px) saturate(170%)", border: "1px solid rgba(255,255,255,.95)", boxShadow: "0 8px 32px rgba(45,18,72,.08)" }}>
              <span style={{ display: "flex", width: "48px", height: "48px", borderRadius: "14px", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: "800", color: "#fff", background: "linear-gradient(135deg, #7C3AED, #5B21B6)" }}>2</span>
              <h3 style={{ margin: "18px 0 8px", fontSize: "19px", color: "#110520" }}>Chat for free</h3>
              <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.6", color: "#4A2870" }}>Message the advertiser on Tharkoo or WhatsApp. Ask for more photos.</p>
            </div>
            <div style={{ padding: "26px", borderRadius: "20px", background: "linear-gradient(160deg, #FFF8EC, #FFFFFF)", backdropFilter: "blur(18px) saturate(170%)", WebkitBackdropFilter: "blur(18px) saturate(170%)", border: "1px solid rgba(255,255,255,.95)", boxShadow: "0 8px 32px rgba(45,18,72,.08)" }}>
              <span style={{ display: "flex", width: "48px", height: "48px", borderRadius: "14px", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: "800", color: "#fff", background: "linear-gradient(135deg, #D1137A, #A8124F)" }}>3</span>
              <h3 style={{ margin: "18px 0 8px", fontSize: "19px", color: "#110520" }}>Verify on video</h3>
              <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.6", color: "#4A2870" }}>A short live video call shows the item or place is real.</p>
            </div>
            <div style={{ padding: "26px", borderRadius: "20px", background: "linear-gradient(160deg, #F0FDF4, #FFFFFF)", backdropFilter: "blur(18px) saturate(170%)", WebkitBackdropFilter: "blur(18px) saturate(170%)", border: "1px solid rgba(255,255,255,.95)", boxShadow: "0 8px 32px rgba(45,18,72,.08)" }}>
              <span style={{ display: "flex", width: "48px", height: "48px", borderRadius: "14px", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: "800", color: "#fff", background: "linear-gradient(135deg, #047857, #065F46)" }}>4</span>
              <h3 style={{ margin: "18px 0 8px", fontSize: "19px", color: "#110520" }}>Meet safely</h3>
              <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.6", color: "#4A2870" }}>Meet in a public place and never pay before you have seen it.</p>
            </div>
          </div>
        </section>
        <section className="h714-pad" style={{ maxWidth: "1280px", margin: "0 auto", padding: "72px 24px 0", boxSizing: "border-box" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: "16px", flexWrap: "wrap", marginBottom: "26px" }}>
            <div>
              <p style={{ display: "inline-block", margin: "0 0 10px", fontSize: "12px", fontWeight: "700", letterSpacing: ".12em", textTransform: "uppercase", color: "#047857", background: "#ECFDF5", borderRadius: "999px", padding: "6px 14px" }}>Your safety</p>
              <h2 className="h714-h2" style={{ margin: "0", fontSize: "40px", letterSpacing: "-.035em", lineHeight: "1.1", color: "#110520" }}>Built to keep you safe</h2>
            </div>
          </div>
          <div className="h714-g3">
            <div style={{ padding: "22px", borderRadius: "20px", background: "rgba(255,255,255,.78)", backdropFilter: "blur(18px) saturate(170%)", WebkitBackdropFilter: "blur(18px) saturate(170%)", border: "1px solid rgba(255,255,255,.95)", boxShadow: "0 8px 32px rgba(45,18,72,.08)" }}>
              <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <span style={{ width: "44px", height: "44px", flex: "none", borderRadius: "12px", background: "#FDF0F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C2185B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4"></path>
                  </svg>
                </span>
                <div>
                  <h3 style={{ margin: "0 0 6px", fontSize: "17px", color: "#110520" }}>Photo verified badge</h3>
                  <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.6", color: "#4A2870" }}>Advertisers who pass a live photo check get a badge on every ad.</p>
                </div>
              </div>
            </div>
            <div style={{ padding: "22px", borderRadius: "20px", background: "rgba(255,255,255,.78)", backdropFilter: "blur(18px) saturate(170%)", WebkitBackdropFilter: "blur(18px) saturate(170%)", border: "1px solid rgba(255,255,255,.95)", boxShadow: "0 8px 32px rgba(45,18,72,.08)" }}>
              <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <span style={{ width: "44px", height: "44px", flex: "none", borderRadius: "12px", background: "#F5F0FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5B21B6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4"></path>
                  </svg>
                </span>
                <div>
                  <h3 style={{ margin: "0 0 6px", fontSize: "17px", color: "#110520" }}>Adults only where needed</h3>
                  <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.6", color: "#4A2870" }}>Dating and personal ads are for 18+ and are checked.</p>
                </div>
              </div>
            </div>
            <div style={{ padding: "22px", borderRadius: "20px", background: "rgba(255,255,255,.78)", backdropFilter: "blur(18px) saturate(170%)", WebkitBackdropFilter: "blur(18px) saturate(170%)", border: "1px solid rgba(255,255,255,.95)", boxShadow: "0 8px 32px rgba(45,18,72,.08)" }}>
              <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <span style={{ width: "44px", height: "44px", flex: "none", borderRadius: "12px", background: "#FFF5E6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 21V4h12l-2 4 2 4H5"></path>
                  </svg>
                </span>
                <div>
                  <h3 style={{ margin: "0 0 6px", fontSize: "17px", color: "#110520" }}>Report in one tap</h3>
                  <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.6", color: "#4A2870" }}>Every ad has Report. Our team reviews reports every day.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="h714-pad" style={{ maxWidth: "1280px", margin: "0 auto", padding: "72px 24px 0", boxSizing: "border-box" }}>
          <div className="h714-2e">
            <div style={{ position: "relative", borderRadius: "20px", overflow: "hidden", aspectRatio: "16/10", background: "linear-gradient(120deg, #FCE4F0 0%, #EDE9FF 45%, #E0F2FE 80%, #FFF5E6 100%)" }}>
              <span style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", fontSize: "13px", fontWeight: "600", color: "rgba(30,11,56,.45)" }}>Video call photo</span>
            </div>
            {" "}
            <div>
              <p style={{ display: "inline-block", margin: "0 0 10px", fontSize: "12px", fontWeight: "700", letterSpacing: ".12em", textTransform: "uppercase", color: "#5B21B6", background: "#F5F0FF", borderRadius: "999px", padding: "6px 14px" }}>Credits</p>
              <h2 className="h714-h2" style={{ margin: "0 0 14px", fontSize: "40px", letterSpacing: "-.035em", lineHeight: "1.1", color: "#110520" }}>See it live before you go</h2>
              <p style={{ margin: "0 0 18px", fontSize: "16px", lineHeight: "1.65", color: "#4A2870" }}>
                Buy a credit pack once. A video call uses 2 credits. Your credits are held until the call ends and go to the advertiser only after a real call. If the advertiser does not answer, the credits come back.
              </p>
              {" "}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", fontSize: "15px", fontWeight: "600", color: "#1E0B38" }}>
                  <span style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#ECFDF5", color: "#047857", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "800" }}>✓</span>
                  Chat with advertisers stays free
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", fontSize: "15px", fontWeight: "600", color: "#1E0B38" }}>
                  <span style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#ECFDF5", color: "#047857", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "800" }}>✓</span>
                  Credits back if there is no call
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", fontSize: "15px", fontWeight: "600", color: "#1E0B38" }}>
                  <span style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#ECFDF5", color: "#047857", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "800" }}>✓</span>
                  {packsText}
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="h714-pad" style={{ maxWidth: "1280px", margin: "0 auto", padding: "72px 24px 0", boxSizing: "border-box" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: "16px", flexWrap: "wrap", marginBottom: "26px" }}>
            <div>
              <p style={{ display: "inline-block", margin: "0 0 10px", fontSize: "12px", fontWeight: "700", letterSpacing: ".12em", textTransform: "uppercase", color: "#0369A1", background: "#F0F9FF", borderRadius: "999px", padding: "6px 14px" }}>Questions</p>
              <h2 className="h714-h2" style={{ margin: "0", fontSize: "40px", letterSpacing: "-.035em", lineHeight: "1.1", color: "#110520" }}>Frequently asked</h2>
            </div>
          </div>
            <FaqList items={faqs} />
        </section>
        <section className="h714-pad" style={{ maxWidth: "1280px", margin: "0 auto", padding: "64px 24px 0", boxSizing: "border-box" }}>
          <div style={{ borderRadius: "22px", padding: "30px 32px", background: "linear-gradient(120deg, #FFF0F7, #F5F0FF 55%, #FFF8EC)", border: "1px solid rgba(255,255,255,.95)", boxShadow: "0 8px 32px rgba(45,18,72,.07)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "18px", flexWrap: "wrap" }}>
            <div>
              <h2 className="h714-h2" style={{ margin: "0 0 6px", fontSize: "30px", letterSpacing: "-.03em", color: "#110520" }}>Ready to start?</h2>
              <p style={{ margin: "0", fontSize: "15px", color: "#4A2870" }}>Browse ads near you or post your own.</p>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <Link href={postAdHref} className="h714-b" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "48px", padding: "0 24px", borderRadius: "999px", background: "linear-gradient(135deg, #D1137A, #A8124F)", color: "#fff", fontWeight: "700", textDecoration: "none", boxShadow: "0 8px 24px rgba(209,19,122,.3)", fontSize: "15px" }}>Post your ad</Link>
              <Link href="/" className="h714-b" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "48px", padding: "0 24px", borderRadius: "999px", border: "1.5px solid #EAD8F0", background: "rgba(255,255,255,.85)", color: "#4A2870", fontWeight: "700", fontSize: "15px", textDecoration: "none" }}>Browse ads</Link>
            </div>
          </div>
        </section>
        {" "}
    </H714Page>
  );
}
