import { cn } from "@/lib/utils";

const control =
  "h-12 w-full rounded-md border border-line bg-surface px-3 text-base text-text placeholder:text-faint focus:border-gold";

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
  const described = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <label className="grid gap-1.5" htmlFor={id}>
      <span className="t-small">{label}</span>
      {children}
      {hint && !error ? (
        <span id={`${id}-hint`} className="t-caption text-muted">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-error`} className="t-caption text-danger">
          {error}
        </span>
      ) : null}
      <Described described={described} />
    </label>
  );
}

function Described({ described }: { described?: string }) {
  return described ? <span className="sr-only" data-describedby={described} /> : null;
}

export function Input({
  id,
  error,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <input
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      className={cn(control, className)}
      {...props}
    />
  );
}

export function Select({
  id,
  error,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: string }) {
  return (
    <select
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      className={cn(control, className)}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({
  id,
  error,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }) {
  return (
    <textarea
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      className={cn(control, "h-auto min-h-28 py-3", className)}
      {...props}
    />
  );
}

export function Checkbox({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-base">
      <input type="checkbox" className="size-5 accent-[var(--gold)]" {...props} />
      <span>{label}</span>
    </label>
  );
}
