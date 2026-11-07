"use client";
import { useSyncExternalStore } from "react";
import {
  DEFAULT_SETTINGS,
  type CatalogItem,
  type Client,
  type Doc,
  type DocType,
  type Line,
  type Settings,
} from "./types";
import { addDays, norm, today } from "./format";

export type State = {
  ready: boolean;
  clients: Client[];
  docs: Doc[];
  catalog: CatalogItem[];
  settings: Settings;
};

export type Table = "clients" | "docs" | "catalog" | "settings";
/** Emitted for every local edit so the sync layer can push it to the shared database. */
export type Change = { table: Table; id: string; deleted?: boolean };

const KEY = "soto:v1";
const SERVER: State = { ready: false, clients: [], docs: [], catalog: [], settings: DEFAULT_SETTINGS };
const listeners = new Set<() => void>();
const changeListeners = new Set<(c: Change) => void>();
let state: State | null = null;

const uid = () => crypto.randomUUID();
const emit = (c: Change) => changeListeners.forEach((l) => l(c));
export const onChange = (cb: (c: Change) => void) => {
  changeListeners.add(cb);
  return () => changeListeners.delete(cb);
};

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        ready: true,
        clients: p.clients ?? [],
        docs: p.docs ?? [],
        catalog: p.catalog ?? [],
        settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
      };
    }
  } catch {}
  return { ready: true, clients: [], docs: [], catalog: [], settings: DEFAULT_SETTINGS };
}

function get(): State {
  if (!state) state = load();
  return state;
}

function persist() {
  try {
    const { clients, docs, catalog, settings } = get();
    localStorage.setItem(KEY, JSON.stringify({ clients, docs, catalog, settings }));
  } catch {}
}

function commit(patch: Partial<State>) {
  state = { ...get(), ...patch };
  persist();
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      state = load();
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Current snapshot outside React (safe after awaits). */
export const getState = get;

export const useStore = () => useSyncExternalStore(subscribe, get, () => SERVER);

// ---------- Remote merge (used by sync; does not emit changes) ----------
export function applyRemote(p: {
  clients?: Client[];
  docs?: Doc[];
  catalog?: CatalogItem[];
  settings?: Settings;
  removed?: { table: Exclude<Table, "settings">; id: string }[];
}) {
  const cur = get();
  const merge = <T extends { id: string }>(list: T[], incoming: T[] | undefined, removed: Set<string>) => {
    if (!incoming?.length && !removed.size) return list;
    const map = new Map(list.map((x) => [x.id, x]));
    removed.forEach((id) => map.delete(id));
    incoming?.forEach((x) => map.set(x.id, x));
    // keep newest-first order like locally created items
    return [...map.values()].sort((a, b) =>
      String((b as { createdAt?: string }).createdAt ?? "").localeCompare(String((a as { createdAt?: string }).createdAt ?? "")),
    );
  };
  const rm = (t: string) => new Set((p.removed ?? []).filter((r) => r.table === t).map((r) => r.id));
  commit({
    clients: merge(cur.clients, p.clients, rm("clients")),
    docs: merge(cur.docs, p.docs, rm("docs")),
    catalog: merge(cur.catalog, p.catalog, rm("catalog")),
    settings: p.settings ? { ...DEFAULT_SETTINGS, ...p.settings } : cur.settings,
  });
}

/** Wipe local data (used when a different account signs in or on sign-out). */
export function resetLocal() {
  commit({ clients: [], docs: [], catalog: [], settings: DEFAULT_SETTINGS });
}

// ---------- Clients ----------
export function addClient(data: Partial<Omit<Client, "id" | "createdAt">> & { name: string }): Client {
  const c: Client = {
    nif: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
    ...data,
    id: uid(),
    createdAt: new Date().toISOString(),
  };
  commit({ clients: [c, ...get().clients] });
  emit({ table: "clients", id: c.id });
  return c;
}

export function updateClient(id: string, patch: Partial<Client>) {
  commit({ clients: get().clients.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  emit({ table: "clients", id });
}

export function deleteClient(id: string) {
  commit({ clients: get().clients.filter((c) => c.id !== id) });
  emit({ table: "clients", id, deleted: true });
}

// ---------- Catalog (saved services / products) ----------
export function addCatalogItem(data: Partial<Omit<CatalogItem, "id" | "createdAt">> & { name: string }): CatalogItem {
  const it: CatalogItem = {
    price: 0,
    vat: get().settings.defaultVat,
    unit: "",
    category: "",
    uses: 0,
    ...data,
    id: uid(),
    createdAt: new Date().toISOString(),
  };
  commit({ catalog: [it, ...get().catalog] });
  emit({ table: "catalog", id: it.id });
  return it;
}

export function updateCatalogItem(id: string, patch: Partial<CatalogItem>) {
  commit({ catalog: get().catalog.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  emit({ table: "catalog", id });
}

export function deleteCatalogItem(id: string) {
  commit({ catalog: get().catalog.filter((c) => c.id !== id) });
  emit({ table: "catalog", id, deleted: true });
}

export const findCatalogByName = (name: string, catalog = get().catalog) => {
  const n = norm(name);
  return n ? catalog.find((c) => norm(c.name) === n) : undefined;
};

/** Save a document line into the catalog (or update the price/IVA of the one with the same name). */
export function saveLineToCatalog(line: Pick<Line, "description" | "price" | "vat">): CatalogItem | null {
  const name = line.description.trim();
  if (!name) return null;
  const existing = findCatalogByName(name);
  if (existing) {
    updateCatalogItem(existing.id, { price: line.price, vat: line.vat });
    return { ...existing, price: line.price, vat: line.vat };
  }
  return addCatalogItem({ name, price: line.price, vat: line.vat });
}

export function bumpCatalogUse(id: string) {
  const it = get().catalog.find((c) => c.id === id);
  if (it) updateCatalogItem(id, { uses: it.uses + 1 });
}

// ---------- Documents ----------
export function nextNumber(type: DocType, docs = get().docs, settings = get().settings) {
  const year = new Date().getFullYear();
  const prefix = type === "quote" ? settings.quotePrefix : settings.invoicePrefix;
  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${esc}-${year}-(\\d+)$`);
  const fmt = (n: number) => `${prefix}-${year}-${String(n).padStart(4, "0")}`;
  const used = new Set<number>();
  let max = 0;
  for (const d of docs) {
    if (d.type !== type) continue;
    const m = re.exec(d.number);
    if (m) {
      const n = parseInt(m[1], 10);
      used.add(n);
      max = Math.max(max, n);
    }
  }
  if (type === "invoice") {
    // Invoice numbers must be consecutive: reuse a number freed by a cancelled/deleted invoice before moving on.
    const free: number[] = [];
    if (used.size) for (let n = Math.min(...used); n < max; n++) if (!used.has(n)) free.push(n);
    for (const d of docs) {
      const m = d.type === "invoice" && d.cancelled?.released ? re.exec(d.cancelled.formerNumber) : null;
      if (m && !used.has(parseInt(m[1], 10))) free.push(parseInt(m[1], 10));
    }
    if (free.length) return fmt(Math.min(...free));
  }
  return fmt(max + 1);
}

export const blankLine = (vat = get().settings.defaultVat): Line => ({
  id: uid(),
  description: "",
  qty: 1,
  price: 0,
  vat,
});

export function createDoc(
  type: DocType,
  opts: {
    clientId?: string;
    lines?: { description: string; qty: number; price: number; vat?: number }[];
    notes?: string;
    fromQuoteId?: string;
  } = {},
): Doc {
  const { settings, docs } = get();
  const d: Doc = {
    id: uid(),
    type,
    number: nextNumber(type),
    clientId: opts.clientId ?? "",
    date: today(),
    dueDate: type === "invoice" ? addDays(today(), settings.paymentDays) : "",
    lines: opts.lines?.length
      ? opts.lines.map((l) => ({ ...l, id: uid(), vat: l.vat ?? settings.defaultVat }))
      : [blankLine()],
    irpf: settings.defaultIrpf,
    status: "draft",
    notes: opts.notes ?? "",
    fromQuoteId: opts.fromQuoteId,
    createdAt: new Date().toISOString(),
  };
  commit({ docs: [d, ...docs] });
  emit({ table: "docs", id: d.id });
  return d;
}

export function updateDoc(id: string, patch: Partial<Doc>) {
  commit({ docs: get().docs.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  emit({ table: "docs", id });
}

export function deleteDoc(id: string) {
  commit({ docs: get().docs.filter((d) => d.id !== id) });
  emit({ table: "docs", id, deleted: true });
}

export function quoteToInvoice(quoteId: string): Doc | null {
  const q = get().docs.find((d) => d.id === quoteId);
  if (!q) return null;
  const existing = get().docs.find((d) => d.fromQuoteId === quoteId && d.status !== "cancelled");
  if (existing) return existing;
  const inv = createDoc("invoice", { clientId: q.clientId, notes: q.notes, fromQuoteId: q.id });
  updateDoc(inv.id, {
    lines: q.lines.map((l) => ({ ...l, id: uid() })),
    irpf: q.irpf,
  });
  updateDoc(q.id, { status: "accepted" });
  return get().docs.find((d) => d.id === inv.id)!;
}

/**
 * Cancel an invoice (client does not go ahead). `releaseNumber`: the invoice never reached the client, so its
 * number is freed and the next invoice reuses it. Otherwise it stays as "Anulada" and keeps its number.
 */
export function cancelInvoice(id: string, releaseNumber: boolean) {
  const d = get().docs.find((x) => x.id === id);
  if (!d || d.type !== "invoice" || d.status === "paid" || d.status === "cancelled") return;
  updateDoc(id, {
    status: "cancelled",
    number: releaseNumber ? "" : d.number,
    cancelled: { at: new Date().toISOString(), formerNumber: d.number, released: releaseNumber },
    lastReminder: undefined,
  });
  const q = d.fromQuoteId ? get().docs.find((x) => x.id === d.fromQuoteId) : undefined;
  if (q && q.status === "accepted") updateDoc(q.id, { status: "rejected" });
}

// ---------- Settings & backup ----------
export function updateSettings(patch: Partial<Settings>) {
  commit({ settings: { ...get().settings, ...patch } });
  emit({ table: "settings", id: "me" });
}

export function exportData() {
  const { clients, docs, catalog, settings } = get();
  return JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), clients, docs, catalog, settings }, null, 2);
}

export function importData(json: string) {
  const p = JSON.parse(json);
  if (!Array.isArray(p.clients) || !Array.isArray(p.docs)) throw new Error("Archivo no válido");
  commit({
    clients: p.clients,
    docs: p.docs,
    catalog: p.catalog ?? [],
    settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
  });
  p.clients.forEach((c: Client) => emit({ table: "clients", id: c.id }));
  p.docs.forEach((d: Doc) => emit({ table: "docs", id: d.id }));
  (p.catalog ?? []).forEach((c: CatalogItem) => emit({ table: "catalog", id: c.id }));
  emit({ table: "settings", id: "me" });
}

// ---------- Helpers ----------
export const clientName = (clients: Client[], id: string) =>
  clients.find((c) => c.id === id)?.name ?? "Sin cliente";
