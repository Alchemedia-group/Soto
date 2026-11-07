import type { jsPDF } from "jspdf";
import type { Client, Doc, Settings } from "./types";
import { addDays, fmtDate, money, totals } from "./format";

/* A4 quote / invoice as a real (text) PDF. Same layout as the printed page: logo, navy band, client box,
   lines table, totals, payment box (invoice) or acceptance signature (quote), brand strip. Millimetres. */

type RGB = [number, number, number];
const NAVY: RGB = [10, 35, 66];
const INK: RGB = [20, 32, 43];
const MUTED: RGB = [88, 104, 120];
const LINE: RGB = [207, 216, 227];
const W = 210, H = 297, M = 15, CW = W - 2 * M;
const LOGO_RATIO = 440 / 1394;

/** Standard PDF fonts only cover Western European text: swap anything else for a safe character. */
const clean = (s: string) =>
  s
    .normalize("NFC")
    .replace(/[−]/g, "-")
    .replace(/[   ]/g, " ")
    .replace(/[^ -ÿ€–—‘’“”•…]/g, "?");

export function pdfFilename(d: Doc, client?: Client) {
  const label = d.type === "quote" ? "Presupuesto" : "Factura";
  const n = d.number || d.cancelled?.formerNumber || "";
  // Plain ASCII so every device, WhatsApp and mail client keeps the name (accents inside the PDF are unaffected).
  return `${label} ${n}${client?.name ? " - " + client.name : ""}.pdf`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ._()-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function makePdf(d: Doc, client: Client | undefined, s: Settings, logoDataUrl?: string, acceptUrl?: string): Promise<jsPDF> {
  const { jsPDF: PDF } = await import("jspdf");
  const doc = new PDF({ unit: "mm", format: "a4", compress: true });
  const isInvoice = d.type === "invoice";
  const t = totals(d);
  const number = d.number || d.cancelled?.formerNumber || "";
  const title = `${isInvoice ? "Factura" : "Presupuesto"} ${number}`;
  doc.setProperties({ title, author: s.companyName, subject: client?.name ?? "" });

  const col = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const text = (str: string, x: number, y: number, o?: { align?: "left" | "right" | "center"; bold?: boolean; size?: number; color?: RGB; charSpace?: number }) => {
    doc.setFont("helvetica", o?.bold ? "bold" : "normal");
    doc.setFontSize(o?.size ?? 9.5);
    col(o?.color ?? INK);
    doc.text(clean(str), x, y, { align: o?.align ?? "left", ...(o?.charSpace ? { charSpace: o.charSpace } : {}) });
  };
  const label = (str: string, x: number, y: number) => text(str.toUpperCase(), x, y, { bold: true, size: 6.8, color: MUTED, charSpace: 0.35 });
  const stroke = (c: RGB, w = 0.25) => { doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(w); };

  /* ---- header: logo + company ---- */
  let y = M;
  if (logoDataUrl) doc.addImage(logoDataUrl, "JPEG", M, y, 56, 56 * LOGO_RATIO);
  else text("SOTO", M, y + 9, { bold: true, size: 26, color: NAVY });
  const company = [s.companyName, s.nif && `NIF ${s.nif}`, ...s.address.split("\n"), s.phone, s.email].filter(Boolean) as string[];
  company.forEach((l, i) => text(l, W - M, y + 3 + i * 4.1, { align: "right", bold: i === 0, size: i === 0 ? 10 : 8.5, color: i === 0 ? INK : MUTED }));
  y = Math.max(y + 56 * LOGO_RATIO, y + 3 + company.length * 4.1) + 6;

  /* ---- band ---- */
  const cancelled = d.status === "cancelled";
  doc.setFillColor(...NAVY);
  doc.roundedRect(M, y, CW, 9.5, 1.2, 1.2, "F");
  text(`${isInvoice ? "FACTURA" : "PRESUPUESTO"}${cancelled ? "  ANULADA" : ""}`, M + 4, y + 6.4, { bold: true, size: 11, color: [255, 255, 255], charSpace: 1.4 });
  text(number, W - M - 4, y + 6.4, { align: "right", bold: true, size: 11, color: [255, 255, 255] });
  y += 15;

  /* ---- client + dates ---- */
  const cl = [client?.nif && `NIF ${client.nif}`, ...(client?.address ?? "").split("\n"), client?.phone, client?.email].filter(Boolean) as string[];
  const bh = Math.max(15.2 + Math.max(cl.length, 1) * 4.1 + 1.5, 26);
  stroke(LINE); doc.roundedRect(M, y, 116, bh, 1.2, 1.2, "S"); doc.roundedRect(M + 120, y, CW - 120, bh, 1.2, 1.2, "S");
  label("Cliente", M + 4, y + 5.5);
  text(client?.name ?? "—", M + 4, y + 10.5, { bold: true, size: 11 });
  cl.forEach((l, i) => text(l, M + 4, y + 15.2 + i * 4.1, { size: 8.8, color: MUTED }));
  label("Fecha", M + 124, y + 5.5); text(fmtDate(d.date), M + 124, y + 10.3);
  label(isInvoice ? "Vencimiento" : "Válido hasta", M + 124, y + 16.5); text(fmtDate(isInvoice ? d.dueDate : addDays(d.date, 30)), M + 124, y + 21.3);
  y += bh + 8;

  /* ---- lines table ---- */
  const X = { desc: M + 2.5, qty: M + 113, price: M + 138, vat: M + 153, amt: M + CW - 2.5 };
  const header = () => {
    doc.setFillColor(...NAVY); doc.roundedRect(M, y, CW, 7.5, 1, 1, "F");
    const h = (str: string, x: number, a: "left" | "right" = "right") => text(str, x, y + 5, { align: a, bold: true, size: 8.3, color: [255, 255, 255] });
    h("Concepto", X.desc, "left"); h("Cant.", X.qty); h("Precio", X.price); h("IVA", X.vat); h("Importe", X.amt);
    y += 7.5;
  };
  header();
  for (const l of d.lines.filter((x) => x.description || x.price)) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(clean(l.description), 100) as string[];
    const rh = Math.max(8, lines.length * 4.3 + 3.6);
    if (y + rh > H - 62) { doc.addPage(); y = M; header(); }
    lines.forEach((ln, i) => text(ln, X.desc, y + 5.4 + i * 4.3));
    text(String(l.qty).replace(".", ","), X.qty, y + 5.4, { align: "right" });
    text(money(l.price), X.price, y + 5.4, { align: "right" });
    text(`${l.vat}%`, X.vat, y + 5.4, { align: "right" });
    text(money(l.qty * l.price), X.amt, y + 5.4, { align: "right", bold: true });
    stroke([226, 232, 240]); doc.line(M, y + rh, M + CW, y + rh);
    y += rh;
  }

  /* ---- totals ---- */
  const rows: [string, string][] = [["Base imponible", money(t.base)], ...t.byRate.map((r) => [`IVA ${r.rate}% s/ ${money(r.base)}`, money(r.vat)] as [string, string])];
  if (d.irpf > 0) rows.push([`Retención IRPF ${d.irpf}%`, `-${money(t.irpf)}`]);
  if (y + rows.length * 5.4 + 14 > H - 40) { doc.addPage(); y = M; }
  y += 6;
  const tx = W - M - 78;
  rows.forEach(([a, b]) => { text(a, tx, y, { size: 9, color: MUTED }); text(b, W - M, y, { align: "right", size: 9 }); y += 5.4; });
  y += 1.5; stroke(NAVY, 0.6); doc.line(tx, y, W - M, y); y += 7;
  text(isInvoice ? "TOTAL A PAGAR" : "TOTAL", tx, y, { bold: true, size: 12.5, color: NAVY });
  text(money(t.total), W - M, y, { align: "right", bold: true, size: 14.5, color: NAVY });
  y += 12;

  /* ---- payment / acceptance ---- */
  if (isInvoice && !cancelled) {
    const pay = [s.iban && `Transferencia bancaria a ${s.iban}`, s.bizum && `Bizum al ${s.bizum}`].filter(Boolean) as string[];
    if (!pay.length) pay.push("Transferencia bancaria");
    const ph = 9 + pay.length * 4.6 + 6;
    if (y + ph > H - 22) { doc.addPage(); y = M; }
    stroke(LINE); doc.roundedRect(M, y, CW, ph, 1.2, 1.2, "S");
    label("Forma de pago", M + 4, y + 5.5);
    pay.forEach((l, i) => text(l, M + 4, y + 11 + i * 4.6, { bold: true }));
    text(`Indica el número de factura ${number} en el concepto.`, M + 4, y + 11 + pay.length * 4.6 + 0.6, { size: 8.5, color: MUTED });
    label("Vence", W - M - 4 - 34, y + 5.5); text(fmtDate(d.dueDate), W - M - 4, y + 12, { align: "right", bold: true, size: 14, color: NAVY });
    y += ph + 6;
  } else if (!isInvoice) {
    if (y + 34 > H - 22) { doc.addPage(); y = M; }
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.8);
    const note = doc.splitTextToSize("Presupuesto válido 30 días desde su fecha.", 90) as string[];
    note.forEach((l, i) => text(l, M, y + 24 + i * 4.2, { size: 8.8, color: MUTED }));
    stroke(INK, 0.3); doc.line(W - M - 70, y + 22, W - M, y + 22);
    label("Aceptado por el cliente · firma y fecha", W - M - 70, y + 26.5);
    y += 34;
    if (acceptUrl) {
      if (y + 8 > H - 22) { doc.addPage(); y = M; }
      text("Acepta este presupuesto online:", M, y, { size: 8.3, color: MUTED });
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); col(NAVY);
      doc.textWithLink(acceptUrl, M, y + 4.2, { url: acceptUrl });
      y += 10;
    }
  }
  if (d.notes.trim()) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.8);
    const nl = doc.splitTextToSize(clean(d.notes), CW) as string[];
    if (y + nl.length * 4.2 > H - 22) { doc.addPage(); y = M; }
    nl.forEach((l, i) => text(l, M, y + i * 4.2, { size: 8.8 }));
    y += nl.length * 4.2 + 3;
  }
  if (s.footer.trim()) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    const fl = doc.splitTextToSize(clean(s.footer), CW) as string[];
    if (y + fl.length * 3.6 > H - 22) { doc.addPage(); y = M; }
    fl.forEach((l, i) => text(l, M, y + i * 3.6, { size: 7.5, color: MUTED }));
  }

  /* ---- brand strip + page numbers on every page ---- */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    stroke(LINE); doc.line(M, H - 14, W - M, H - 14);
    text("FONTANERÍA  ·  CLIMA  ·  ELECTRICIDAD  ·  FOTOVOLTAICA", W / 2, H - 10, { align: "center", bold: true, size: 7, color: NAVY, charSpace: 0.9 });
    if (pages > 1) text(`Página ${p} de ${pages}`, W / 2, H - 5.5, { align: "center", size: 7.5, color: MUTED });
  }
  return doc;
}
