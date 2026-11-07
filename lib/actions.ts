"use client";
import { addClient, bumpCatalogUse, createDoc, quoteToInvoice, updateDoc, type State } from "./store";
import { searchCatalog } from "./catalog";
import { totals, norm } from "./format";
import { STATUSES_BY_TYPE, STATUS_LABEL, type DocStatus, type DocType } from "./types";

export type Action = { name: string; input: Record<string, unknown> };
export type ActionResult = { message: string; path?: string };

/** Compact snapshot of the business sent to the assistant so it can answer questions. */
export function buildContext(s: State) {
  const docs = s.docs.slice(0, 80).map((d) => ({
    number: d.number,
    type: d.type,
    client: s.clients.find((c) => c.id === d.clientId)?.name ?? "",
    status: d.status,
    total: totals(d).total,
    date: d.date,
    due: d.dueDate || undefined,
  }));
  const unpaid = s.docs.filter((d) => d.type === "invoice" && d.status === "sent");
  return {
    today: new Date().toISOString().slice(0, 10),
    defaultVat: s.settings.defaultVat,
    clients: s.clients.slice(0, 200).map((c) => c.name),
    documents: docs,
    catalog: s.catalog.slice(0, 150).map((c) => ({ name: c.name, price: c.price, vat: c.vat, unit: c.unit })),
    pendingToCollect: unpaid.reduce((sum, d) => sum + totals(d).total, 0),
  };
}

const num = (v: unknown, d = 0) => (typeof v === "number" && isFinite(v) ? v : d);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function findClient(s: State, name: string) {
  const n = norm(name);
  if (!n) return undefined;
  return (
    s.clients.find((c) => norm(c.name) === n) ??
    s.clients.find((c) => norm(c.name).includes(n) || n.includes(norm(c.name)))
  );
}

/** Match "F-2026-0003", or just "3" / "0003" (latest document with that sequence number). */
function findDoc(s: State, number: string) {
  const n = norm(number).replace(/\s/g, "");
  if (!n) return undefined;
  const exact = s.docs.find((d) => norm(d.number) === n);
  if (exact) return exact;
  if (/^\d+$/.test(n)) {
    const seq = parseInt(n, 10);
    return s.docs.find((d) => parseInt(d.number.split("-").pop() ?? "", 10) === seq);
  }
  return undefined;
}

export function runAction(a: Action, getState: () => State): ActionResult {
  const s = getState();
  const i = a.input;
  switch (a.name) {
    case "create_client": {
      const name = str(i.name);
      if (!name) return { message: "Falta el nombre del cliente." };
      const existing = findClient(s, name);
      if (existing) return { message: `${existing.name} ya existe.`, path: `/clientes/${existing.id}` };
      const c = addClient({
        name,
        phone: str(i.phone),
        email: str(i.email),
        nif: str(i.nif),
        address: str(i.address),
      });
      return { message: `Cliente ${c.name} creado.`, path: `/clientes/${c.id}` };
    }
    case "create_document": {
      const type: DocType = i.type === "invoice" ? "invoice" : "quote";
      const cname = str(i.client_name);
      let client = findClient(s, cname);
      if (!client && cname) client = addClient({ name: cname });
      const lines = (Array.isArray(i.lines) ? i.lines : [])
        .map((l) => l as Record<string, unknown>)
        .map((l) => {
          const description = str(l.description);
          const hasPrice = typeof l.price === "number" && isFinite(l.price) && l.price > 0;
          // No price given: look the item up in the saved catalog (price + IVA come with it).
          const hit = !hasPrice && description ? searchCatalog(s.catalog, description, 1)[0] : undefined;
          if (hit) bumpCatalogUse(hit.id);
          return hit
            ? { description: hit.name, qty: num(l.qty, 1), price: hit.price, vat: hit.vat }
            : { description, qty: num(l.qty, 1), price: num(l.price) };
        })
        .filter((l) => l.description);
      const d = createDoc(type, { clientId: client?.id, lines, notes: str(i.notes) });
      return {
        message: `${type === "quote" ? "Presupuesto" : "Factura"} ${d.number} creado en borrador.`,
        path: `/documentos/${d.id}`,
      };
    }
    case "set_status": {
      const d = findDoc(s, str(i.number));
      const status = i.status as DocStatus;
      if (!d) return { message: `No encuentro el documento ${str(i.number)}.` };
      if (!STATUSES_BY_TYPE[d.type].includes(status))
        return { message: `${d.number} no puede estar en estado "${STATUS_LABEL[status]}".` };
      updateDoc(d.id, { status });
      const nudge = d.type === "quote" && status === "accepted" ? " ¿Quieres que la pase a factura?" : "";
      return { message: `${d.number} marcado como ${STATUS_LABEL[status].toLowerCase()}.${nudge}`, path: `/documentos/${d.id}` };
    }
    case "convert_quote_to_invoice": {
      const d = findDoc(s, str(i.number));
      if (!d || d.type !== "quote") return { message: `No encuentro ese presupuesto.` };
      const inv = quoteToInvoice(d.id);
      return inv
        ? { message: `Factura ${inv.number} creada desde ${d.number}.`, path: `/documentos/${inv.id}` }
        : { message: "No se pudo convertir." };
    }
    case "open":
      return openTarget(s, str(i.target));
    default:
      return { message: "" };
  }
}

function openTarget(s: State, target: string): ActionResult {
  const t = norm(target);
  const routes: Record<string, string> = {
    inicio: "/",
    resumen: "/",
    clientes: "/clientes",
    presupuestos: "/presupuestos",
    facturas: "/facturas",
    ajustes: "/ajustes",
  };
  if (routes[t]) return { message: `Abriendo ${t}.`, path: routes[t] };
  const d = findDoc(s, target);
  if (d) return { message: `Abriendo ${d.number}.`, path: `/documentos/${d.id}` };
  const c = findClient(s, target);
  if (c) return { message: `Abriendo ${c.name}.`, path: `/clientes/${c.id}` };
  return { message: `No encuentro "${target}".` };
}

/** Very small offline parser so the mic still navigates / adds clients without an API key. */
export function localFallback(text: string): Action[] {
  const t = norm(text);
  const m = t.match(/^(?:nuevo|crear|crea|anadir|anade|alta)\s+cliente\s+(.+)$/);
  if (m) return [{ name: "create_client", input: { name: text.trim().replace(/^\S+\s+cliente\s+/i, "") } }];
  for (const k of ["clientes", "presupuestos", "facturas", "ajustes", "inicio"]) {
    if (t.includes(k)) return [{ name: "open", input: { target: k } }];
  }
  return [];
}

