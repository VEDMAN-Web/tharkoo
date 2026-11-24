import { useT } from "@/components/help/UiTextProvider";
import { SelectField, TextField } from "./FormFields";

type Place = { id: string; name: string };

type Props = {
  nickname: string;
  cityId: string;
  cities: Place[];
  error: (key: string) => string | undefined;
  onBlur: (key: string) => () => void;
  onNickname: (value: string) => void;
  onCity: (value: string) => void;
};

/** H19.6b: the name on the ads and the city, asked after the contact fields. The date of birth and the 18+ tick are gone: the tick is on the last step only. */
export function AboutYou({ nickname, cityId, cities, error, onBlur, onNickname, onCity }: Props) {
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
    </div>
  );
}
