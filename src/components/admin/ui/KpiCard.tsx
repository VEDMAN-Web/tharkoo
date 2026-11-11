export function KpiCard({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: string | number | null;
  hint?: string;
  /** e.g. "+4.2%": a leading + is shown green, a leading - red. Omit when there is no real comparison. */
  delta?: string;
}) {
  const tone = delta?.startsWith("+") ? "is-up" : delta?.startsWith("-") ? "is-down" : "";
  return (
    <div className="adm-kpi">
      <p className="adm-kpi-label">{label}</p>
      <p className="adm-kpi-value">{value ?? "No data yet"}</p>
      {delta ? <p className={`adm-kpi-delta ${tone}`}>{delta}</p> : null}
      {hint ? <p className="adm-kpi-hint">{hint}</p> : null}
    </div>
  );
}
