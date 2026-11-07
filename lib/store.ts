"use client";
import { useSyncExternalStore } from "react";
import {
  DEFAULT_SETTINGS,
  type Client,
  type Doc,
  type DocType,
  type Line,
  type Settings,
} from "./types";
import { addDays, today } from "./format";

export type State = {
  ready: boolean;
  clients: Client[];
  docs: Doc[];
  settings: Settings;
};

const KEY = "soto:v1";
const SERVER: State = { ready: false, clients: [], docs: [], settings: DEFAULT_SETTINGS };
const listeners = new Set<() => void>();
let state: State | null = null;

const uid = () => crypto.randomUUID();

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        ready: true,
        clients: p.clients ?? [],
        docs: p.docs ?? [],
        settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
      };
    }
  } catch {}
  return { ready: true, clients: [], docs: [], settings: DEFAULT_SETTINGS };
}

function get(): State {
  if (!state) state = load();
  return state;
}

function persist() {
  try {
    const { clients, docs, settings } = get();
    localStorage.setItem(KEY, JSON.stringify({ clients, docs, settings }));
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
  return c;
}

export function updateClient(id: string, patch: Partial<Client>) {
  commit({ clients: get().clients.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
}

export function deleteClient(id: string) {
  commit({ clients: get().clients.filter((c) => c.id !== id) });
}

// ---------- Documents ----------
export function nextNumber(type: DocType, docs = get().docs, settings = get().settings) {
  const year = new Date().getFullYear();
  const prefix = type === "quote" ? settings.quotePrefix : settings.invoicePrefix;
  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${esc}-${year}-(\\d+)$`);
  let max = 0;
  for (const d of docs) {
    if (d.type !== type) continue;
    const m = re.exec(d.number);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${year}-${String(max + 1).padStart(4, "0")}`;
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
  opts: { clientId?: string; lines?: Omit<Line, "id" | "vat">[]; notes?: string; fromQuoteId?: string } = {},
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
      ? opts.lines.map((l) => ({ ...l, id: uid(), vat: settings.defaultVat }))
      : [blankLine()],
    irpf: settings.defaultIrpf,
    status: "draft",
    notes: opts.notes ?? "",
    fromQuoteId: opts.fromQuoteId,
    createdAt: new Date().toISOString(),
  };
  commit({ docs: [d, ...docs] });
  return d;
}

export function updateDoc(id: string, patch: Partial<Doc>) {
  commit({ docs: get().docs.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
}

export function deleteDoc(id: string) {
  commit({ docs: get().docs.filter((d) => d.id !== id) });
}

export function quoteToInvoice(quoteId: string): Doc | null {
  const q = get().docs.find((d) => d.id === quoteId);
  if (!q) return null;
  const existing = get().docs.find((d) => d.fromQuoteId === quoteId);
  if (existing) return existing;
  const inv = createDoc("invoice", { clientId: q.clientId, notes: q.notes, fromQuoteId: q.id });
  updateDoc(inv.id, {
    lines: q.lines.map((l) => ({ ...l, id: uid() })),
    irpf: q.irpf,
  });
  updateDoc(q.id, { status: "accepted" });
  return get().docs.find((d) => d.id === inv.id)!;
}

// ---------- Settings & backup ----------
export function updateSettings(patch: Partial<Settings>) {
  commit({ settings: { ...get().settings, ...patch } });
}

export function exportData() {
  const { clients, docs, settings } = get();
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), clients, docs, settings }, null, 2);
}

export function importData(json: string) {
  const p = JSON.parse(json);
  if (!Array.isArray(p.clients) || !Array.isArray(p.docs)) throw new Error("Archivo no válido");
  commit({ clients: p.clients, docs: p.docs, settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) } });
}

// ---------- Helpers ----------
export const clientName = (clients: Client[], id: string) =>
  clients.find((c) => c.id === id)?.name ?? "Sin cliente";
