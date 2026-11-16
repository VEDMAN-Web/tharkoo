export function SelectField({
  id,
  label,
  required,
  value,
  error,
  disabled,
  help,
  onBlur,
  onChange,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  error?: string;
  disabled?: boolean;
  help?: string;
  onBlur?: () => void;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className={`tk-field ${error ? "is-bad" : ""}`} htmlFor={id}>
      <span>{required ? "* " : ""}{label}</span>
      <select id={id} value={value} disabled={disabled} onBlur={onBlur} onChange={(event) => onChange(event.target.value)}>{children}</select>
      {help ? <span className="t-caption" style={{ color: "var(--muted)" }}>{help}</span> : null}
      {error ? <span className="tk-error" data-tk="field-error">{error}</span> : null}
    </label>
  );
}

export function TextField({
  id,
  label,
  required,
  value,
  error,
  note,
  placeholder,
  area,
  rows,
  inputMode,
  type,
  autoComplete,
  onBlur,
  onChange,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  error?: string;
  note?: string;
  placeholder?: string;
  area?: boolean;
  rows?: number;
  inputMode?: "numeric" | "tel" | "text";
  type?: "text" | "date";
  autoComplete?: string;
  onBlur?: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <label className={`tk-field ${error ? "is-bad" : ""}`} htmlFor={id}>
      <span style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{required ? "* " : ""}{label}</span>
        {note ? <span style={{ fontWeight: 500, color: "var(--muted)" }}>{note}</span> : null}
      </span>
      {area ? (
        <textarea
          id={id}
          rows={rows || 2}
          value={value}
          placeholder={placeholder}
          onBlur={onBlur}
          ref={(node) => {
            if (!node) return;
            node.style.height = "auto";
            node.style.height = `${Math.min(node.scrollHeight + 2, 200)}px`;
          }}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input id={id} type={type} autoComplete={autoComplete} value={value} placeholder={placeholder} inputMode={inputMode} onBlur={onBlur} onChange={(event) => onChange(event.target.value)} />
      )}
      {error ? <span className="tk-error" data-tk="field-error">{error}</span> : null}
    </label>
  );
}
