import Link from "next/link";
import { Icon, PageBand, type IconName } from "./PageParts";
import { ContactForm } from "./ContactForm";
import "./new-design.css";
import { telHref, telegramHref, whatsappHref } from "@/lib/support";

export type ContactInfo = {
  email: string;
  phone: string;
  whatsapp: string;
  telegram: string;
  hours: string;
  office: string;
};

type Card = { icon: IconName; color: string; tint: string; title: string; sub: string; href?: string; action?: string };

export function ContactView({
  title,
  info,
  grievanceHref,
  helpHref,
  homeHref,
}: {
  title: string;
  info: ContactInfo;
  grievanceHref: string;
  helpHref: string;
  homeHref: string;
}) {
  const whatsapp = whatsappHref(info.whatsapp);
  const telegram = telegramHref(info.telegram);
  const cards: Card[] = [
    { icon: "chat", color: "#C2185B", tint: "#FDF0F7", title: "Live chat", sub: "Fastest, about 10 minutes", href: "#contact-form", action: "Send a message" },
    {
      icon: "phone",
      color: "#5B21B6",
      tint: "#F5F0FF",
      title: "WhatsApp",
      sub: info.whatsapp || "Message us for quick help",
      href: whatsapp || undefined,
      action: "Open WhatsApp",
    },
    {
      icon: "mail",
      color: "#92400E",
      tint: "#FFF5E6",
      title: "Email",
      sub: info.email || "Write to the support team",
      href: info.email ? `mailto:${info.email}` : undefined,
      action: "Write to us",
    },
    {
      icon: "clock",
      color: "#047857",
      tint: "#ECFDF5",
      title: "Phone",
      sub: info.hours || "Mon to Sat, 9 am to 9 pm",
      href: telHref(info.phone) || undefined,
      action: "Call us",
    },
  ];

  return (
    <>
      <PageBand crumbs={[{ label: "Tharkoo India", href: homeHref }, { label: "Contact" }]} title={title}>
        <p className="tkp-lede">Questions about an ad, a payment or your account? Pick the way that suits you.</p>
      </PageBand>

      <section className="tkp-section">
        <div className="tkp-cards">
          {cards.map((card) => (
            <div key={card.title} className="tkp-card">
              <span className="tkp-card-icon" style={{ background: card.tint }}>
                <Icon name={card.icon} color={card.color} />
              </span>
              <span>
                <span className="tkp-card-title">{card.title}</span>
                <span className="tkp-card-sub">{card.sub}</span>
              </span>
              {card.href && card.action ? (
                <a className="tkp-card-link" href={card.href}>
                  {card.action} <Icon name="arrow" size={16} color="#C2185B" width={2.4} />
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="tkp-section">
        <div className="tkp-2r">
          <div id="contact-form" className="tkp-glass tkp-form-card">
            <h2 className="tkp-h2">Send us a message</h2>
            <ContactForm />
          </div>
          <div>
            <div className="tkp-glass tkp-side-card">
              <div className="tkp-side-row">
                <span className="tkp-side-icon" style={{ background: "#FFF5E6" }}>
                  <Icon name="clock" color="#92400E" />
                </span>
                <div>
                  <h3>Support hours</h3>
                  <p>{info.hours || "Mon to Sat, 9 am to 9 pm IST. Sunday chat only."}</p>
                </div>
              </div>
            </div>
            {telegram ? (
              <div className="tkp-glass tkp-side-card">
                <div className="tkp-side-row">
                  <span className="tkp-side-icon" style={{ background: "#F0F9FF" }}>
                    <Icon name="chat" color="#0369A1" />
                  </span>
                  <div>
                    <h3>Telegram</h3>
                    <p>
                      <a className="tkp-link" href={telegram}>
                        {info.telegram.replace(/^@?/, "@")}
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="tkp-glass tkp-side-card">
              <div className="tkp-side-row">
                <span className="tkp-side-icon" style={{ background: "#ECFDF5" }}>
                  <Icon name="pin" color="#047857" />
                </span>
                <div>
                  <h3>Office</h3>
                  <p>{info.office || "Write to us and we will share our office details."}</p>
                </div>
              </div>
            </div>
            <div className="tkp-glass tkp-side-card">
              <div className="tkp-side-row">
                <span className="tkp-side-icon" style={{ background: "#F0F9FF" }}>
                  <Icon name="shield" color="#0369A1" />
                </span>
                <div>
                  <h3>Grievance officer</h3>
                  <p>
                    For complaints under the IT Rules, 2021.{" "}
                    <Link className="tkp-link" href={grievanceHref}>
                      Contact the grievance officer
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </div>
            <p className="tkp-lede">
              <Link className="tkp-link" href={helpHref}>
                Read the help centre
              </Link>{" "}
              for quick answers.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
