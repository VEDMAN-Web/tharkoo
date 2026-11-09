const PhoneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      fillRule="evenodd"
      d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z"
      clipRule="evenodd"
      fill="currentColor"
    />
  </svg>
);

const WaIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M1.695 17.837L0 24l6.335-1.654C8.08 23.294 10.05 23.793 12.05 23.794 18.637 23.794 24 18.459 24 11.902 24.001 8.724 22.76 5.736 20.503 3.488 18.247 1.24 15.246 0 12.05 0 5.464 0 .103 5.335.1 11.891.1 13.988.65 16.033 1.695 17.837zM12.046 21.785c-2.126-.001-3.734-.597-5.418-1.592L2.869 21.174l1.004-3.648C2.772 15.783 2.117 14.117 2.118 11.892 2.12 6.442 6.576 2.008 12.054 2.008c5.492.002 9.93 4.43 9.928 9.892-.003 5.451-4.462 9.885-9.936 9.885z"
      fill="currentColor"
    />
  </svg>
);

const TgIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 20" fill="none" aria-hidden>
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M1.65 8.61c6.442-2.823 10.738-4.683 12.888-5.582C20.675.46 21.95.015 22.782 0c.182-.003.591.042.856.259.223.182.285.428.314.601.03.173.066.567.037.875-.332 3.514-1.771 12.041-2.503 15.977-.31 1.665-.92 2.223-1.51 2.278-1.284.119-2.259-.853-3.502-1.672-1.945-1.282-3.044-2.08-4.932-3.331-2.181-1.446-.767-2.24.477-3.54.325-.34 5.98-5.511 6.089-5.98.014-.059.026-.278-.103-.393s-.32-.076-.457-.045c-.196.045-3.303 2.11-9.322 6.196-.882.609-1.681.905-2.397.89-.789-.017-2.307-.449-3.435-.818-1.384-.452-2.484-.691-2.388-1.46.05-.4.598-.809 1.644-1.227z"
      clipRule="evenodd"
    />
  </svg>
);

export function ContactButtons({
  phone,
  whatsapp,
  telegram,
  compact,
  sticky,
}: {
  phone?: string | null;
  whatsapp?: string | null;
  telegram?: string | null;
  compact?: boolean;
  sticky?: boolean;
}) {
  const wa = whatsapp ? `https://wa.me/91${whatsapp.replace(/\D/g, "").replace(/^91/, "")}` : null;
  const tg = telegram ? `https://t.me/${telegram.replace(/^@/, "")}` : null;
  return (
    <div className={`contact-row ${compact ? "contact-row-compact" : ""} ${sticky ? "contact-row-sticky" : ""}`}>
      {phone ? (
        <a className="btn-phone" href={`tel:${phone}`}>
          <PhoneIcon />
          <span>{phone}</span>
        </a>
      ) : null}
      {wa ? (
        <a className="btn-whatsapp" href={wa} target="_blank" rel="nofollow noopener noreferrer">
          <WaIcon />
          <span>WhatsApp</span>
        </a>
      ) : null}
      {tg ? (
        <a className="btn-telegram" href={tg} target="_blank" rel="nofollow noopener noreferrer">
          <TgIcon />
          <span>Telegram</span>
        </a>
      ) : null}
    </div>
  );
}
