"use client";
import { useEffect, useState } from "react";

const parse = (t: string) => {
  const n = parseFloat(t.replace(",", "."));
  return isNaN(n) ? 0 : n;
};

/** Decimal input that lets you type "1," or "0.5" without the value snapping back. */
export function NumInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (parse(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parse(e.target.value));
      }}
    />
  );
}
