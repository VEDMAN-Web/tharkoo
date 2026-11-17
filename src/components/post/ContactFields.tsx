import { useT } from "@/components/help/UiTextProvider";
import type { UiTextKey } from "@/lib/ui/text";
import { Switch, TextField } from "./FormFields";

export const CONTACT_CHOICES: [string, UiTextKey][] = [
  ["both", "post.contactBox.both"],
  ["phone", "post.contactBox.phone"],
  ["email", "post.contactBox.email"],
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
  const t = useT();
  const { mode, maskedEmail, phone, whatsapp, whatsappSame, whatsappNumber, telegramOn, telegram, error, onBlur } = props;
  const showPhone = mode !== "email";
  return (
    <>
      <p className="tkp-sub-title" style={{ margin: 0 }}>{t("post.contactBox.question")}</p>
      <div className="tkp-chips" role="group" aria-label={t("post.contactBox.groupLabel")}>
        {CONTACT_CHOICES.map(([id, labelKey]) => (
          <button key={id} type="button" className={`tkp-chip ${mode === id ? "on" : ""}`} aria-pressed={mode === id} onClick={() => props.onMode(id)}>
            {t(labelKey)}
          </button>
        ))}
      </div>
      {mode !== "phone" && maskedEmail ? <p className="tkp-quiet" data-tk="account-email">{t("post.contactBox.accountEmail", { email: maskedEmail })}</p> : null}
      {showPhone ? (
        <>
          <div className="tkp-two tkp-two-keep tkp-end">
            <TextField id="phone" label={t("post.contactBox.phoneLabel")} required value={phone} error={error("phone")} onBlur={onBlur("phone")} inputMode="tel" placeholder="+91 81234 56789" onChange={props.onPhone} />
            <div className="tkp-toggle-row tkp-wrap" data-tk="whatsapp-options">
              <span>{t("post.contactBox.whatsapp")}</span>
              <Switch on={whatsapp} onClick={props.onWhatsapp} label={t("post.contactBox.whatsapp")} />
              {whatsapp ? (
                <span className="tkp-same">
                  <input id="whatsapp-same" type="checkbox" className="tk-check" checked={whatsappSame} onChange={props.onWhatsappSame} />
                  <label htmlFor="whatsapp-same">{t("post.contactBox.whatsappSame")}</label>
                </span>
              ) : null}
            </div>
          </div>
          {whatsapp && !whatsappSame ? (
            <div className="tkp-two tkp-two-keep">
              <TextField id="whatsapp-number" label={t("post.contactBox.whatsappNumber")} required value={whatsappNumber} error={error("whatsapp")} onBlur={onBlur("whatsapp")} inputMode="tel" placeholder="+91 81234 56789" onChange={props.onWhatsappNumber} />
              <span />
            </div>
          ) : null}
        </>
      ) : null}
      <div className="tkp-two tkp-two-keep tkp-end">
        <div className="tkp-toggle-row"><span>{t("post.contactBox.telegram")}</span><Switch on={telegramOn} onClick={props.onTelegramOn} label={t("post.contactBox.telegram")} /></div>
        {telegramOn ? (
          <TextField id="telegram" label={t("post.contactBox.telegramUsername")} required value={telegram} error={error("telegram")} onBlur={onBlur("telegram")} placeholder={t("post.contactBox.telegramPlaceholder")} onChange={props.onTelegram} />
        ) : (
          <span />
        )}
      </div>
    </>
  );
}
