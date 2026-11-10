import { cn } from "@/lib/utils";

const control = "w-full rounded-md border border-line bg-card px-3 text-text";

export function Field({
  label,
  hint,
  error,
  children,
  id,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  id: string;
}) {
  return (
    <label className={`tk-field ${error ? "is-bad" : ""}`} htmlFor={id}>
      <span>{label}</span>
      {children}
      {hint && !error ? <span className="t-caption" style={{ color: "var(--muted)", fontWeight: 500 }}>{hint}</span> : null}
      {error ? (
        <span id={`${id}-error`} className="tk-error" data-tk="field-error">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(control, "h-11", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(control, "h-11", props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(control, props.className)} />;
}

export function Checkbox({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" {...props} className="mt-1" />
      <span>{label}</span>
    </label>
  );
}

export function Switch({
  on,
  label,
  onClick,
  bad,
}: {
  on: boolean;
  label: string;
  onClick: () => void;
  bad?: boolean;
}) {
  return (
    <button type="button" className="tk-switch" data-on={on ? "yes" : "no"} aria-pressed={on} onClick={onClick} style={bad ? { outline: "1px solid var(--danger)" } : undefined}>
      <i />
      <span className="sr-only">{label}</span>
      <span style={{ marginLeft: 22 }}>{on ? "YES" : "NO"}</span>
    </button>
  );
}
