"use client";

import { Info, MessageCircle, Send } from "lucide-react";
import { useT } from "@/components/help/UiTextProvider";
import { POST_NAME_MAX, POST_PHONE_PREFIX } from "@/lib/ui/post-form";
import "./about-step.css";

/**
 * H21.4: Step 4, About you. The name on the ads (and the age for people ads), the phone number with the country code, and the other ways to be reached:
 * WhatsApp (the same number or its own) and Telegram, each a switch with its field right under it. There is no city here: the city is chosen in step 2.
 */

type Props = {
  nickname: string;
  /** The age field, only for people categories. */
  age?: { value: string; required: boolean };
  /** True for people categories: the name hint is the plain-name one. */
  people: boolean;
  phone: string;
  whatsapp: boolean;
  whatsappSame: boolean;
  whatsappNumber: string;
  telegramOn: boolean;
  telegram: string;
  error: (key: string) => string | undefined;
  onBlur: (key: string) => () => void;
  onNickname: (value: string) => void;
  onAge: (value: string) => void;
  onPhone: (value: string) => void;
  onWhatsapp: () => void;
  onWhatsappSame: () => void;
  onWhatsappNumber: (value: string) => void;
  onTelegramOn: () => void;
  onTelegram: (value: string) => void;
  /** First-time accounts: the note says what is saved with the ad. */
  children?: React.ReactNode;
};

function Switch({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`tka-sw${on ? " on" : ""}`} onClick={onClick}>
      <span />
    </button>
  );
}

/** The country code is shown in front of the box, so a saved number does not show it twice. */
function shownNumber(value: string) {
  return value.replace(/^\+91\s*/, "");
}

function Err({ text }: { text?: string }) {
  return text ? <p className="tka-err" data-tk="field-error">{text}</p> : null;
}

export function AboutYouStep(props: Props) {
  const t = useT();
  const { error, onBlur } = props;
  return (
    <div className="tka" data-tk="contact-fields">
      <p className="tka-note" data-tk="about-note"><Info size={18} aria-hidden="true" focusable="false" /><span>{t("post.v2.about.remember")}</span></p>

      <div className="tka-fld">
        <label className="tka-lbl" htmlFor="nickname">
          <span>{t("post.v2.about.name")} <span className="tka-req" aria-hidden="true">*</span></span>
          <span className="tka-count">{props.nickname.length} / {POST_NAME_MAX}</span>
        </label>
        <input
          id="nickname"
          className={`tka-inp${error("nickname") ? " err" : ""}`}
          value={props.nickname}
          maxLength={POST_NAME_MAX}
          autoComplete="nickname"
          aria-invalid={error("nickname") ? true : undefined}
          onChange={(event) => props.onNickname(event.target.value.slice(0, POST_NAME_MAX))}
          onBlur={onBlur("nickname")}
        />
        {error("nickname") ? <Err text={error("nickname")} /> : <p className="tka-hint" data-tk="nickname-hint">{props.people ? t("post.field.nicknameHint") : t("post.v2.about.nameHint")}</p>}
      </div>

      {props.age ? (
        <div className="tka-fld">
          <label className="tka-lbl" htmlFor="age">
            <span>{t("post.field.age")} {props.age.required ? <span className="tka-req" aria-hidden="true">*</span> : null}</span>
          </label>
          <input
            id="age"
            className={`tka-inp${error("age") ? " err" : ""}`}
            value={props.age.value}
            inputMode="numeric"
            placeholder={t("post.field.agePlaceholder")}
            aria-invalid={error("age") ? true : undefined}
            onChange={(event) => props.onAge(event.target.value.replace(/\D/g, "").slice(0, 2))}
            onBlur={onBlur("age")}
          />
          <Err text={error("age")} />
        </div>
      ) : null}

      <div className="tka-fld">
        <label className="tka-lbl" htmlFor="phone">
          <span>{t("post.v2.about.phone")} <span className="tka-req" aria-hidden="true">*</span></span>
        </label>
        <div className="tka-affix">
          <span className="tka-pre" aria-hidden="true">{POST_PHONE_PREFIX}</span>
          <input
            id="phone"
            className={`tka-inp tka-pad-phone${error("phone") ? " err" : ""}`}
            value={shownNumber(props.phone)}
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="81234 56789"
            aria-invalid={error("phone") ? true : undefined}
            onChange={(event) => props.onPhone(event.target.value)}
            onBlur={onBlur("phone")}
          />
        </div>
        {error("phone") ? <Err text={error("phone")} /> : <p className="tka-hint" data-tk="phone-hint">{t("post.v2.about.phoneHint")}</p>}
      </div>

      <div className="tka-group">
        <p className="tka-sec">{t("post.v2.about.alsoReach")}</p>
        <div className="tka-tgl" data-tk="whatsapp-options">
          <span className="tka-tgl-name"><MessageCircle size={20} aria-hidden="true" focusable="false" />{t("post.contactBox.whatsapp")}</span>
          <Switch on={props.whatsapp} label={t("post.contactBox.whatsapp")} onClick={props.onWhatsapp} />
        </div>
        {props.whatsapp ? (
          <label className="tka-check" htmlFor="whatsapp-same">
            <input id="whatsapp-same" type="checkbox" checked={props.whatsappSame} onChange={props.onWhatsappSame} />
            <span>{t("post.v2.about.same")}</span>
          </label>
        ) : null}
        {props.whatsapp && !props.whatsappSame ? (
          <div className="tka-fld">
            <label className="tka-lbl" htmlFor="whatsapp-number">
              <span>{t("post.contactBox.whatsappNumber")} <span className="tka-req" aria-hidden="true">*</span></span>
            </label>
            <div className="tka-affix">
              <span className="tka-pre" aria-hidden="true">{POST_PHONE_PREFIX}</span>
              <input
                id="whatsapp-number"
                className={`tka-inp tka-pad-phone${error("whatsapp") ? " err" : ""}`}
                value={shownNumber(props.whatsappNumber)}
                inputMode="tel"
                aria-invalid={error("whatsapp") ? true : undefined}
                onChange={(event) => props.onWhatsappNumber(event.target.value)}
                onBlur={onBlur("whatsapp")}
              />
            </div>
            <Err text={error("whatsapp")} />
          </div>
        ) : null}
        <div className="tka-tgl" data-tk="telegram-option">
          <span className="tka-tgl-name"><Send size={20} aria-hidden="true" focusable="false" />{t("post.contactBox.telegram")}</span>
          <Switch on={props.telegramOn} label={t("post.contactBox.telegram")} onClick={props.onTelegramOn} />
        </div>
        {props.telegramOn ? (
          <div className="tka-fld">
            <label className="tka-lbl" htmlFor="telegram">
              <span>{t("post.contactBox.telegramUsername")} <span className="tka-req" aria-hidden="true">*</span></span>
            </label>
            <div className="tka-affix">
              <span className="tka-pre" aria-hidden="true">@</span>
              <input
                id="telegram"
                className={`tka-inp tka-pad-at${error("telegram") ? " err" : ""}`}
                value={props.telegram}
                autoCapitalize="off"
                autoComplete="off"
                placeholder={t("post.v2.about.telegramPlaceholder")}
                aria-invalid={error("telegram") ? true : undefined}
                onChange={(event) => props.onTelegram(event.target.value)}
                onBlur={onBlur("telegram")}
              />
            </div>
            <Err text={error("telegram")} />
          </div>
        ) : null}
      </div>
      {props.children}
    </div>
  );
}
