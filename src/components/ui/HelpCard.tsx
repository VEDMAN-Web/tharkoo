"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Headset, Mail } from "lucide-react";
import { telegramHref, whatsappHref } from "@/lib/support";

export function HelpCard() {
  const [facts, setFacts] = useState({ hours: "", wa: "", tg: "" });
  useEffect(() => {
    const id = window.setTimeout(() => {
      const node = document.getElementById("tk-facts");
      if (!node) return;
      setFacts({
        hours: node.getAttribute("data-hours") || "",
        wa: node.getAttribute("data-wa") || "",
        tg: node.getAttribute("data-tg") || "",
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, []);
  const wa = whatsappHref(facts.wa);
  const tg = telegramHref(facts.tg);
  return (
    <section className="tk-help" data-tk="help-card">
      <h2>
        Do you need help? <Headset size={16} aria-hidden />
      </h2>
      <p>
        For <strong>information</strong> or <strong>technical support</strong>, click the button below.
      </p>
      <Link href="/contact/" className="tk-btn tk-btn-outline-primary" style={{ width: "100%" }}>
        <Mail size={14} /> Contact us
      </Link>
      {wa || tg ? (
        <>
          <p>
            We are also available on <strong>WhatsApp</strong> or <strong>Telegram</strong>.{facts.hours ? ` Support hours: ${facts.hours}.` : ""}
          </p>
          <div className="tk-help-actions">
            {wa ? <a className="tk-btn tk-btn-outline-primary" href={wa}>WhatsApp</a> : null}
            {tg ? <a className="tk-btn tk-btn-outline-primary" href={tg}>Telegram</a> : null}
          </div>
        </>
      ) : (
        facts.hours ? <p>Support hours: {facts.hours}.</p> : null
      )}
    </section>
  );
}
