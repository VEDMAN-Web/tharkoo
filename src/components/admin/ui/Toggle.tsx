"use client";

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <span className="adm-toggle">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className="adm-toggle-box"
        onClick={() => onChange(!checked)}
      />
      <span aria-hidden>{label}</span>
    </span>
  );
}
