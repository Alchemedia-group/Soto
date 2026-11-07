import type { Client, Doc, Settings } from "./types";
import { fmtDate, money, phoneForWhatsApp, today, totals } from "./format";

export const isOverdue = (d: Doc) =>
  d.type === "invoice" && d.status === "sent" && !!d.dueDate && d.dueDate < today();

export const daysOverdue = (d: Doc) =>
  d.dueDate ? Math.max(0, Math.round((Date.parse(today()) - Date.parse(d.dueDate)) / 86400000)) : 0;

/** Friendly payment-reminder text (Spanish). Wording adapts to overdue vs. not yet due. */
export function reminderMessage(doc: Doc, client: Client | undefined, s: Settings) {
  const total = money(totals(doc).total);
  const due = doc.dueDate
    ? doc.dueDate < today()
      ? `venció el ${fmtDate(doc.dueDate)}`
      : `vence el ${fmtDate(doc.dueDate)}`
    : "está pendiente";
  const pay = s.iban
    ? `Puedes abonarla por transferencia a ${s.iban}, indicando el número de factura.`
    : "Si tienes cualquier duda sobre el pago, respóndenos a este mensaje.";
  const subject = `Recordatorio de pago – Factura ${doc.number}`;
  const body = [
    `Hola${client ? " " + client.name : ""},`,
    "",
    `Te escribimos de ${s.companyName} para recordarte que la factura ${doc.number}, de fecha ${fmtDate(doc.date)}, por importe de ${total}, ${due} y figura pendiente de pago.`,
    "",
    pay,
    "",
    "Si ya la has abonado, ignora este mensaje y disculpa las molestias.",
    "",
    "Un saludo,",
    s.companyName,
    s.phone,
  ]
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n")
    .trim();
  return { subject, body };
}

export function reminderMailto(doc: Doc, client: Client | undefined, s: Settings) {
  const { subject, body } = reminderMessage(doc, client, s);
  return `mailto:${client?.email ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\n/g, "\r\n"))}`;
}

export function reminderWhatsApp(doc: Doc, client: Client | undefined, s: Settings) {
  const { body } = reminderMessage(doc, client, s);
  return `https://wa.me/${phoneForWhatsApp(client?.phone ?? "")}?text=${encodeURIComponent(body)}`;
}
