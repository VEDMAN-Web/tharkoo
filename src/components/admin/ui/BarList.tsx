export function BarList({ items, emptyText = "No data yet" }: { items: { label: string; value: number }[]; emptyText?: string }) {
  if (!items.length) return <p className="adm-field-help">{emptyText}</p>;
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <ul className="adm-bars">
      {items.map((item) => (
        <li key={item.label} className="adm-bar-row">
          <span className="adm-bar-label">{item.label}</span>
          <span className="adm-bar-value">{item.value.toLocaleString("en-IN")}</span>
          <span className="adm-bar-track" aria-hidden>
            <span className="adm-bar-fill" style={{ display: "block", width: `${Math.round((item.value / max) * 100)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}
