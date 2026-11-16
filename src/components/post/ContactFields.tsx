import { Switch, TextField } from "./FormFields";

export const CONTACT_CHOICES: [string, string][] = [
  ["both", "Phone and email"],
  ["phone", "Phone only"],
  ["email", "Email only"],
];

type Props = {
  mode: string;
  maskedEmail: string;
  phone: string;
  whatsapp: boolean;
  whatsappSame: boolean;
  whatsappNumber: string;
  telegramOn: boolean;
  telegram: string;
  error: (key: string) => string | undefined;
  onBlur: (key: string) => () => void;
  onMode: (value: string) => void;
  onPhone: (value: string) => void;
  onWhatsapp: () => void;
  onWhatsappSame: () => void;
  onWhatsappNumber: (value: string) => void;
  onTelegramOn: () => void;
  onTelegram: (value: string) => void;
};

export function ContactFields(props: Props) {
  const { mode, maskedEmail, phone, whatsapp, whatsappSame, whatsappNumber, telegramOn, telegram, error, onBlur } = props;
  const showPhone = mode !== "email";
  return (
    <>
      <p className="tkp-sub-title" style={{ margin: 0 }}>How should people reach you?</p>
      <div className="tkp-chips" role="group" aria-label="How people reach you">
        {CONTACT_CHOICES.map(([id, label]) => (
          <button key={id} type="button" className={`tkp-chip ${mode === id ? "on" : ""}`} aria-pressed={mode === id} onClick={() => props.onMode(id)}>
            {label}
          </button>
        ))}
      </div>
      {mode !== "phone" && maskedEmail ? <p className="tkp-quiet" data-tk="account-email">We will use your account email: {maskedEmail}</p> : null}
      {showPhone ? (
        <>
          <TextField id="phone" label="Phone number" required value={phone} error={error("phone")} onBlur={onBlur("phone")} inputMode="tel" placeholder="+91 81234 56789" onChange={props.onPhone} />
          <div className="tkp-toggle-row"><span>WhatsApp</span><Switch on={whatsapp} onClick={props.onWhatsapp} label="WhatsApp" /></div>
          {whatsapp ? (
            <div className="tkp-sub-fields" data-tk="whatsapp-options">
              <div className="tkp-consent">
                <input id="whatsapp-same" type="checkbox" className="tk-check" checked={whatsappSame} onChange={props.onWhatsappSame} />
                <label htmlFor="whatsapp-same">Same as phone number</label>
              </div>
              {whatsappSame ? null : (
                <TextField id="whatsapp-number" label="WhatsApp number" required value={whatsappNumber} error={error("whatsapp")} onBlur={onBlur("whatsapp")} inputMode="tel" placeholder="+91 81234 56789" onChange={props.onWhatsappNumber} />
              )}
            </div>
          ) : null}
        </>
      ) : null}
      <div className="tkp-toggle-row"><span>Telegram</span><Switch on={telegramOn} onClick={props.onTelegramOn} label="Telegram" /></div>
      {telegramOn ? (
        <TextField id="telegram" label="Telegram username" required value={telegram} error={error("telegram")} onBlur={onBlur("telegram")} placeholder="@yourname" onChange={props.onTelegram} />
      ) : null}
    </>
  );
}
