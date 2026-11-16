"use client";

import { useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const APPLY_DELAY_MS = 120;

export function InstantForm({ action, className, label, children }: { action: string; className?: string; label: string; children: ReactNode }) {
  const router = useRouter();
  const timer = useRef<number>(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function apply(form: HTMLFormElement) {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form).entries()) {
      if (typeof value === "string" && value !== "") params.append(key, value);
    }
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${action}?${query}` : action, { scroll: false });
  }

  function onChange(event: FormEvent<HTMLFormElement>) {
    const target = event.target as HTMLInputElement;
    if (!target.name || target.name === "q") return;
    const form = event.currentTarget;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => apply(form), APPLY_DELAY_MS);
  }

  return (
    <form
      method="get"
      action={action}
      className={className}
      aria-label={label}
      onChange={onChange}
      onSubmit={(event) => {
        event.preventDefault();
        window.clearTimeout(timer.current);
        apply(event.currentTarget);
      }}
    >
      {children}
    </form>
  );
}
