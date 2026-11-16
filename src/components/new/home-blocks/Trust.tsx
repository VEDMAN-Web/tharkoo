const TRUST_SHOWN = 5;

export function HomeTrust({ pills }: { pills: { label: string }[] }) {
  return (
    <ul className="tkh-trust" tabIndex={0} aria-label="Why Tharkoo">
      {pills.slice(0, TRUST_SHOWN).map((pill) => (
        <li key={pill.label}>
          <i aria-hidden="true" />
          {pill.label}
        </li>
      ))}
    </ul>
  );
}
