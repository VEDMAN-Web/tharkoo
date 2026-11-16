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
  return (
    <div className="tkp-fields" data-tk="about-you">
      <div className="tkp-two tkp-two-keep">
        <TextField id="about-name" label="Name on your ads" required value={nickname} error={error("nickname")} onBlur={onBlur("nickname")} autoComplete="nickname" placeholder="Your name or nickname" onChange={(value) => onNickname(value.slice(0, 20))} />
        <SelectField id="about-city" label="Your city" required value={cityId} error={error("city")} onBlur={onBlur("city")} onChange={onCity}>
          <option value="">Select city</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>{city.name}</option>
          ))}
        </SelectField>
      </div>
      {askDateOfBirth ? (
        <div className="tkp-two">
          <TextField id="about-dob" label="Date of birth" required type="date" autoComplete="bday" note="Never shown on your ads" value={dateOfBirth} error={error("dob")} onBlur={onBlur("dob")} onChange={onDateOfBirth} />
          <div className={`tkp-consent tkp-consent-box ${error("ageConfirmed") ? "is-bad" : ""}`}>
            <input id="about-adult" type="checkbox" className="tk-check" checked={ageConfirmed} onChange={onAgeConfirmed} aria-invalid={Boolean(error("ageConfirmed"))} />
            <label htmlFor="about-adult">
              <strong>I am 18 or older</strong>
              <span>Needed once to post. Some categories also ask for a quick ID check.</span>
            </label>
            {error("ageConfirmed") ? <span className="tk-error" data-tk="field-error">{error("ageConfirmed")}</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
