import { useT } from "@/components/help/UiTextProvider";
import { Switch, TextField } from "./FormFields";

type Props = {
  phone: string;
  whatsapp: boolean;
  whatsappSame: boolean;
  whatsappNumber: string;
  telegramOn: boolean;
  telegram: string;
  error: (key: string) => string | undefined;
  onBlur: (key: string) => () => void;
  onPhone: (value: string) => void;
  onWhatsapp: () => void;
  onWhatsappSame: () => void;
  onWhatsappNumber: (value: string) => void;
  onTelegramOn: () => void;
  onTelegram: (value: string) => void;
};

/**
 * H19.6b: the phone number (required), then WhatsApp and Telegram as switches. A switch that is on shows its own box right under it.
 * Emails are never shown on ads, so there is no email choice here.
 */
export function ContactFields(props: Props) {
  const t = useT();
  const { phone, whatsapp, whatsappSame, whatsappNumber, telegramOn, telegram, error, onBlur } = props;
  return (
    <div className="tkp-fields" data-tk="contact-fields">
      <TextField id="phone" label={t("post.contactBox.phoneLabel")} required value={phone} error={error("phone")} onBlur={onBlur("phone")} inputMode="tel" placeholder="+91 81234 56789" onChange={props.onPhone} />
      <p className="tkp-quiet" data-tk="phone-hint" style={{ margin: "-6px 0 0" }}>{t("post.contactBox.phoneHint")}</p>
      <div className="tkp-toggle-row" data-tk="whatsapp-options">
        <span>{t("post.contactBox.whatsapp")}</span>
        <Switch on={whatsapp} onClick={props.onWhatsapp} label={t("post.contactBox.whatsapp")} />
      </div>
      {whatsapp ? (
        <span className="tkp-same">
          <input id="whatsapp-same" type="checkbox" className="tk-check" checked={whatsappSame} onChange={props.onWhatsappSame} />
          <label htmlFor="whatsapp-same">{t("post.contactBox.whatsappSame")}</label>
        </span>
      ) : null}
      {whatsapp && !whatsappSame ? (
        <TextField id="whatsapp-number" label={t("post.contactBox.whatsappNumber")} required value={whatsappNumber} error={error("whatsapp")} onBlur={onBlur("whatsapp")} inputMode="tel" placeholder="+91 81234 56789" onChange={props.onWhatsappNumber} />
      ) : null}
      <div className="tkp-toggle-row" data-tk="telegram-option">
        <span>{t("post.contactBox.telegram")}</span>
        <Switch on={telegramOn} onClick={props.onTelegramOn} label={t("post.contactBox.telegram")} />
      </div>
      {telegramOn ? (
        <TextField id="telegram" label={t("post.contactBox.telegramUsername")} required value={telegram} error={error("telegram")} onBlur={onBlur("telegram")} placeholder={t("post.contactBox.telegramPlaceholder")} onChange={props.onTelegram} />
      ) : null}
    </div>
  );
}
