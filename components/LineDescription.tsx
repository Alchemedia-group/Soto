"use client";
import { useMemo, useState } from "react";
import { searchCatalog } from "@/lib/catalog";
import { money, norm } from "@/lib/format";
import type { CatalogItem } from "@/lib/types";

/** Description input that suggests saved catalog items as you type; picking one fills price + IVA. */
export function LineDescription({
  value,
  catalog,
  onText,
  onPick,
}: {
  value: string;
  catalog: CatalogItem[];
  onText: (t: string) => void;
  onPick: (it: CatalogItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const sugg = useMemo(() => searchCatalog(catalog, value), [catalog, value]);
  const exact = catalog.some((c) => norm(c.name) === norm(value));
  const show = open && sugg.length > 0 && !exact;

  const pick = (it: CatalogItem) => { onPick(it); setOpen(false); };

  return (
    <div style={{ position: "relative" }}>
      <input
        value={value}
        placeholder="Ej. Instalación de caldera"
        role="combobox"
        aria-expanded={show}
        aria-autocomplete="list"
        autoComplete="off"
        onChange={(e) => { onText(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, sugg.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); pick(sugg[hi]); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {show && (
        <ul role="listbox" className="suggest">
          {sugg.map((it, i) => (
            <li key={it.id} role="option" aria-selected={i === hi} className={i === hi ? "on" : ""}
              onPointerDown={(e) => { e.preventDefault(); pick(it); }}>
              <span>{it.name}{it.category && <small className="muted"> · {it.category}</small>}</span>
              <strong>{money(it.price)}{it.unit ? ` / ${it.unit}` : ""}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
