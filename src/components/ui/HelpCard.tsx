"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Headset, Mail } from "lucide-react";

export function HelpCard() {
  const [facts, setFacts] = useState({ hours: "Monday through Friday", wa: "", tg: "" });
  useEffect(() => {
    const id = window.setTimeout(() => {
      const node = document.getElementById("tk-facts");
      if (!node) return;
      setFacts({
        hours: node.getAttribute("data-hours") || "Monday through Friday",
        wa: node.getAttribute("data-wa") || "",
        tg: node.getAttribute("data-tg") || "",
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, []);
  const wa = facts.wa.replace(/\D/g, "");
  return (
    <section className="tk-help" data-tk="help-card">
      <h2>
        Do you need help? <Headset size={16} aria-hidden />
      </h2>
      <p>
        For <strong>information</strong> or <strong>technical support</strong>, click the button below.
      </p>
      <Link href="/contact/" className="tk-btn tk-btn-outline-gold" style={{ width: "100%" }}>
        <Mail size={14} /> CONTACT US
      </Link>
      {wa || facts.tg ? (
        <>
          <p>
            We are also available on <strong>WhatsApp</strong> or <strong>Telegram</strong> Monday through Friday, excluding holidays, from {facts.hours}.
          </p>
          <div className="tk-help-actions">
            {wa ? <a className="tk-btn tk-btn-outline-gold" href={`https://wa.me/${wa}`}>WhatsApp</a> : null}
            {facts.tg ? <a className="tk-btn tk-btn-outline-gold" href={`https://t.me/${facts.tg.replace(/^@/, "")}`}>Telegram</a> : null}
          </div>
        </>
      ) : (
        <p>Support hours: {facts.hours}, excluding holidays.</p>
      )}
    </section>
  );
}
