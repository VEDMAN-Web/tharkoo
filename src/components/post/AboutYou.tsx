import { useT } from "@/components/help/UiTextProvider";
import { SelectField, TextField } from "./FormFields";

type Place = { id: string; name: string };

type Props = {
  nickname: string;
  cityId: string;
  cities: Place[];
  askDateOfBirth: boolean;
  dateOfBirth: string;
  ageConfirmed: boolean;
  error: (key: string) => string | undefined;
  onBlur: (key: string) => () => void;
  onNickname: (value: string) => void;
  onCity: (value: string) => void;
  onDateOfBirth: (value: string) => void;
  onAgeConfirmed: () => void;
};

export function AboutYou({ nickname, cityId, cities, askDateOfBirth, dateOfBirth, ageConfirmed, error, onBlur, onNickname, onCity, onDateOfBirth, onAgeConfirmed }: Props) {
  const t = useT();
  return (
    <div className="tkp-fields" data-tk="about-you">
      <div className="tkp-two tkp-two-keep">
        <TextField id="about-name" label={t("post.aboutYou.name")} required value={nickname} error={error("nickname")} onBlur={onBlur("nickname")} autoComplete="nickname" placeholder={t("post.aboutYou.namePlaceholder")} onChange={(value) => onNickname(value.slice(0, 20))} />
        <SelectField id="about-city" label={t("post.aboutYou.city")} required value={cityId} error={error("city")} onBlur={onBlur("city")} onChange={onCity}>
          <option value="">{t("post.aboutYou.selectCity")}</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>{city.name}</option>
          ))}
        </SelectField>
      </div>
      {askDateOfBirth ? (
        <div className="tkp-two">
          <TextField id="about-dob" label={t("post.aboutYou.dob")} required type="date" autoComplete="bday" note={t("post.aboutYou.dobNote")} value={dateOfBirth} error={error("dob")} onBlur={onBlur("dob")} onChange={onDateOfBirth} />
          <div className={`tkp-consent tkp-consent-box ${error("ageConfirmed") ? "is-bad" : ""}`}>
            <input id="about-adult" type="checkbox" className="tk-check" checked={ageConfirmed} onChange={onAgeConfirmed} aria-invalid={Boolean(error("ageConfirmed"))} />
            <label htmlFor="about-adult">
              <strong>{t("post.aboutYou.adult")}</strong>
              <span>{t("post.aboutYou.adultNote")}</span>
            </label>
            {error("ageConfirmed") ? <span className="tk-error" data-tk="field-error">{error("ageConfirmed")}</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
