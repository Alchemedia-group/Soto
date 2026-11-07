import type { Doc } from "./types";

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
export const money = (n: number) => eur.format(n || 0);

export const today = () => new Date().toISOString().slice(0, 10);

export function addDays(iso: string, days: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function fmtDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function totals(doc: Pick<Doc, "lines" | "irpf">) {
  let base = 0;
  const byRate = new Map<number, { base: number; vat: number }>();
  for (const l of doc.lines) {
    const b = r2(l.qty * l.price);
    base += b;
    const cur = byRate.get(l.vat) ?? { base: 0, vat: 0 };
    cur.base += b;
    cur.vat += r2((b * l.vat) / 100);
    byRate.set(l.vat, cur);
  }
  const vat = [...byRate.values()].reduce((s, x) => s + x.vat, 0);
  const irpf = r2((base * (doc.irpf || 0)) / 100);
  return {
    base: r2(base),
    vat: r2(vat),
    irpf,
    total: r2(base + vat - irpf),
    byRate: [...byRate.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([rate, v]) => ({ rate, base: r2(v.base), vat: r2(v.vat) })),
  };
}

export const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function phoneForWhatsApp(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 9 ? "34" + digits : digits;
}
