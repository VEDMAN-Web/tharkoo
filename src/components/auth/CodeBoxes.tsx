"use client";

import { type KeyboardEvent, useRef } from "react";
import { CODE_LENGTH, backspaceCode, clearCodeDigit, focusIndexAfterWrite, typedDigits, writeCodeDigits } from "@/components/auth/sign-in-input";

interface Props {
  /** The digits entered so far, no gaps. */
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** Id of the message under the boxes, so a wrong code is read out with them. */
  describedBy?: string;
  invalid?: boolean;
}

/** Six one-digit boxes. Typing, pasting, overwriting and Backspace all work; the parent gets the joined digits. */
export function CodeBoxes({ value, onChange, disabled = false, describedBy, invalid = false }: Props) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  function focusBox(index: number) {
    boxes.current[index]?.focus();
    boxes.current[index]?.select();
  }

  function handleInput(index: number, raw: string) {
    const existing = value[index] ?? "";
    const digits = typedDigits(existing, raw);
    if (digits === "") {
      if (existing) onChange(clearCodeDigit(value, index));
      return;
    }
    onChange(writeCodeDigits(value, index, digits));
    focusBox(focusIndexAfterWrite(value, index, digits));
  }

  function handleKey(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Backspace" || value[index]) return;
    event.preventDefault();
    if (index === 0) return;
    onChange(backspaceCode(value, index));
    focusBox(index - 1);
  }

  return (
    <div role="group" aria-label="6-digit code" className="tk-si-codes">
      {Array.from({ length: CODE_LENGTH }, (_, index) => (
        <input
          key={index}
          ref={(node) => {
            boxes.current[index] = node;
          }}
          className="tk-si-in tk-si-code tk-si-focus"
          data-focus={index === 0 ? "" : undefined}
          aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          value={value[index] ?? ""}
          disabled={disabled}
          onChange={(event) => handleInput(index, event.target.value)}
          onKeyDown={(event) => handleKey(index, event)}
        />
      ))}
    </div>
  );
}
