"use client";

import { useEffect, useRef, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { setListingBusy } from "./listing-busy";

const APPLY_DELAY_MS = 120;

/**
 * The filter form. A change applies at once (after a short pause) by moving to the new address without a page reload:
 * the old results stay on screen and dim while the new ones load. `syncKey` is the filter state the server last rendered;
 * when it changes (a pick, "Clear all", or another place chosen) the boxes are set to match it, so they never show a filter
 * that is not applied.
 */
export function InstantForm({ action, className, label, syncKey, children }: { action: string; className?: string; label: string; syncKey?: string; children: ReactNode }) {
  const router = useRouter();
  const timer = useRef<number>(0);
  const formRef = useRef<HTMLFormElement>(null);
  const lastKey = useRef(syncKey);
  const [pending, startTransition] = useTransition();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    setListingBusy(pending);
    return () => setListingBusy(false);
  }, [pending]);

  useEffect(() => {
    if (pending || lastKey.current === syncKey) return;
    lastKey.current = syncKey;
    formRef.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"], input[type="number"]').forEach((input) => {
      if (input.type === "checkbox") input.checked = input.defaultChecked;
      else input.value = input.defaultValue;
    });
  }, [syncKey, pending]);

  function apply(form: HTMLFormElement) {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form).entries()) {
      if (typeof value === "string" && value !== "") params.append(key, value);
    }
    params.delete("page");
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${action}?${query}` : action, { scroll: false });
    });
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
      ref={formRef}
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
