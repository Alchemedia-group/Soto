"use client";
import { useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, syncEnabled } from "./supabase";
import { applyRemote, getState, onChange, resetLocal, type Table } from "./store";
import type { CatalogItem, Client, Doc, Settings } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export type SyncState = {
  /** false until we know whether someone is signed in */
  ready: boolean;
  enabled: boolean;
  signedIn: boolean;
  email: string;
  status: "off" | "idle" | "syncing" | "offline" | "error";
  lastSync: string; // ISO
  pending: number;
  error: string;
  /** Things that happened while the app was open (e.g. a client accepted a quote). */
  notices: Notice[];
};
export type Notice = { id: string; text: string; docId: string };

let snap: SyncState = {
  ready: !syncEnabled,
  enabled: syncEnabled,
  signedIn: false,
  email: "",
  status: syncEnabled ? "idle" : "off",
  lastSync: "",
  pending: 0,
  error: "",
  notices: [],
};
const subs = new Set<() => void>();
const set = (p: Partial<SyncState>) => {
  snap = { ...snap, ...p };
  subs.forEach((s) => s());
};
const SERVER_SNAP: SyncState = { ...snap, ready: false };
export const useSync = () =>
  useSyncExternalStore(
    (cb) => (subs.add(cb), () => subs.delete(cb)),
    () => snap,
    () => SERVER_SNAP,
  );

// ---------- row <-> entity mapping ----------
const toClient = (r: Row): Client => ({
  id: r.id, name: r.name, nif: r.nif, email: r.email, phone: r.phone, address: r.address, notes: r.notes, createdAt: r.created_at,
});
const fromClient = (c: Client): Row => ({
  id: c.id, name: c.name, nif: c.nif, email: c.email, phone: c.phone, address: c.address, notes: c.notes, created_at: c.createdAt, deleted_at: null,
});
const toDoc = (r: Row): Doc => ({
  id: r.id, type: r.type, number: r.number, clientId: r.client_id ?? "", date: r.date, dueDate: r.due_date ?? "",
  lines: r.lines ?? [], irpf: Number(r.irpf) || 0, status: r.status, notes: r.notes,
  fromQuoteId: r.from_quote_id ?? undefined, lastReminder: r.last_reminder ?? undefined, cancelled: r.cancelled ?? undefined, shareToken: r.share_token ?? undefined, response: r.response ?? undefined, createdAt: r.created_at,
});
const fromDoc = (d: Doc): Row => ({
  id: d.id, type: d.type, number: d.number, client_id: d.clientId || null, date: d.date, due_date: d.dueDate || null,
  lines: d.lines, irpf: d.irpf, status: d.status, notes: d.notes, from_quote_id: d.fromQuoteId ?? null,
  last_reminder: d.lastReminder ?? null, cancelled: d.cancelled ?? null, share_token: d.shareToken ?? null, created_at: d.createdAt, deleted_at: null,
  // `response` is written only by the server (the client's answer), so it is never sent from here.
});
const toItem = (r: Row): CatalogItem => ({
  id: r.id, name: r.name, price: Number(r.price) || 0, vat: Number(r.vat) || 0, unit: r.unit, category: r.category,
  uses: r.uses ?? 0, createdAt: r.created_at,
});
const fromItem = (c: CatalogItem): Row => ({
  id: c.id, name: c.name, price: c.price, vat: c.vat, unit: c.unit, category: c.category, uses: c.uses, created_at: c.createdAt, deleted_at: null,
});

const DB: Record<Exclude<Table, "settings">, string> = { clients: "clients", docs: "docs", catalog: "catalog_items" };

// ---------- dirty queue (survives reloads / offline) ----------
type Dirty = { deleted: boolean; seq: number };
let dirty = new Map<string, Dirty>();
let seq = 0;
let uidNow = "";
const dkey = (t: Table, id: string) => `${t}:${id}`;
const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };

function saveDirty() {
  lsSet("soto:dirty", JSON.stringify([...dirty.entries()]));
  set({ pending: dirty.size });
}
function loadDirty() {
  try { dirty = new Map(JSON.parse(lsGet("soto:dirty") ?? "[]")); } catch { dirty = new Map(); }
  seq = Math.max(0, ...[...dirty.values()].map((d) => d.seq));
  set({ pending: dirty.size });
}
function markDirty(t: Table, id: string, deleted = false) {
  dirty.set(dkey(t, id), { deleted, seq: ++seq });
  saveDirty();
  schedulePush();
}

// ---------- push ----------
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushing = false;
function schedulePush(ms = 800) {
  if (!supabase || !uidNow) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void push(), ms);
}

const fail = (e: unknown) => {
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as any).message) : "Error";
  set({ status: offline || /fetch|network/i.test(msg) ? "offline" : "error", error: msg });
};

export async function push() {
  if (!supabase || !uidNow || pushing || dirty.size === 0) return;
  pushing = true;
  set({ status: "syncing", error: "" });
  try {
    const batch = [...dirty.entries()];
    const st = getState();
    const upserts: Record<string, Row[]> = { clients: [], docs: [], catalog_items: [] };
    let settingsRow: Row | null = null;
    const deletes: { table: string; id: string }[] = [];
    for (const [k, v] of batch) {
      const [t, id] = k.split(":") as [Table, string];
      if (t === "settings") { settingsRow = { data: st.settings }; continue; }
      if (v.deleted) { deletes.push({ table: DB[t], id }); continue; }
      if (t === "clients") { const c = st.clients.find((x) => x.id === id); if (c) upserts.clients.push(fromClient(c)); }
      if (t === "docs") { const d = st.docs.find((x) => x.id === id); if (d) upserts.docs.push(fromDoc(d)); }
      if (t === "catalog") { const c = st.catalog.find((x) => x.id === id); if (c) upserts.catalog_items.push(fromItem(c)); }
    }
    for (const [table, rows] of Object.entries(upserts)) {
      if (!rows.length) continue;
      const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
      if (error) throw error;
    }
    for (const d of deletes) {
      const { error } = await supabase.from(d.table).update({ deleted_at: new Date().toISOString() }).eq("id", d.id);
      if (error) throw error;
    }
    if (settingsRow) {
      const { error } = await supabase.from("settings").upsert({ owner: uidNow, ...settingsRow }, { onConflict: "owner" });
      if (error) throw error;
    }
    // Only clear entries that were not edited again while we were pushing.
    for (const [k, v] of batch) if (dirty.get(k)?.seq === v.seq) dirty.delete(k);
    saveDirty();
    set({ status: "idle", lastSync: new Date().toISOString(), error: "" });
  } catch (e) {
    fail(e);
  } finally {
    pushing = false;
    if (dirty.size && snap.status === "idle") schedulePush(300);
  }
}

// ---------- pull ----------
let pullTimer: ReturnType<typeof setTimeout> | null = null;
let pulling = false;
const schedulePull = (ms = 300) => {
  if (pullTimer) clearTimeout(pullTimer);
  pullTimer = setTimeout(() => void pull(), ms);
};
const sinceKey = (t: string) => `soto:since:${uidNow}:${t}`;

export async function pull() {
  if (!supabase || !uidNow || pulling) return;
  pulling = true;
  try {
    const out: Parameters<typeof applyRemote>[0] = { removed: [], clients: [], docs: [], catalog: [] };
    for (const t of ["clients", "docs", "catalog"] as const) {
      const since = lsGet(sinceKey(t)) ?? "1970-01-01T00:00:00Z";
      const { data, error } = await supabase.from(DB[t]).select("*").gt("updated_at", since).order("updated_at", { ascending: true }).limit(1000);
      if (error) throw error;
      let max = since;
      for (const r of data ?? []) {
        if (r.updated_at > max) max = r.updated_at;
        if (dirty.has(dkey(t, r.id))) continue; // local edit not pushed yet: it wins
        if (r.deleted_at) out.removed!.push({ table: t, id: r.id });
        else if (t === "clients") out.clients!.push(toClient(r));
        else if (t === "docs") out.docs!.push(toDoc(r));
        else out.catalog!.push(toItem(r));
      }
      lsSet(sinceKey(t), max);
    }
    const { data: s, error: se } = await supabase.from("settings").select("*").eq("owner", uidNow).maybeSingle();
    if (se) throw se;
    const lastS = lsGet(sinceKey("settings")) ?? "";
    if (s && s.updated_at > lastS && !dirty.has(dkey("settings", "me"))) {
      out.settings = s.data as Settings;
      lsSet(sinceKey("settings"), s.updated_at);
    }
    // A client answered a quote while the app was open: tell the owner (only for documents already known on this device).
    const known = getState();
    for (const dd of out.docs ?? []) {
      const old = known.docs.find((x) => x.id === dd.id);
      const key = dd.id + ":" + dd.response?.at;
      if (old && dd.response && dd.response.at !== old.response?.at && !wasNotified(key)) {
        const who = [...(out.clients ?? []), ...known.clients].find((c) => c.id === dd.clientId)?.name || dd.response.name || "Un cliente";
        addNotice({ id: key, docId: dd.id, text: `${who} ha ${dd.response.decision === "accepted" ? "aceptado" : "rechazado"} el presupuesto ${dd.number}` });
      }
    }
    applyRemote(out);
    set({ status: dirty.size ? snap.status : "idle", lastSync: new Date().toISOString(), error: "" });
  } catch (e) {
    fail(e);
  } finally {
    pulling = false;
  }
}

// ---------- notices ----------
const wasNotified = (k: string) => { try { return (JSON.parse(lsGet("soto:notified") ?? "[]") as string[]).includes(k); } catch { return false; } };
function addNotice(n: Notice) {
  try { lsSet("soto:notified", JSON.stringify([...(JSON.parse(lsGet("soto:notified") ?? "[]") as string[]), n.id].slice(-200))); } catch {}
  set({ notices: [...snap.notices, n] });
}
export const dismissNotice = (id: string) => set({ notices: snap.notices.filter((n) => n.id !== id) });

// ---------- lifecycle ----------
let started = false;
let channel: RealtimeChannel | null = null;
let interval: ReturnType<typeof setInterval> | null = null;

async function onSession(userId: string, email: string) {
  if (!supabase || uidNow === userId) return; // already running (token refresh etc.)
  const prev = lsGet("soto:uid");
  if (prev && prev !== userId) { resetLocal(); dirty = new Map(); saveDirty(); } // different account on this device
  lsSet("soto:uid", userId);
  uidNow = userId;
  loadDirty();
  set({ signedIn: true, email, ready: true });

  // First time this account syncs on this device: upload whatever is already stored locally.
  if (!lsGet(`soto:migrated:${userId}`)) {
    const st = getState();
    st.clients.forEach((c) => dirty.set(dkey("clients", c.id), { deleted: false, seq: ++seq }));
    st.docs.forEach((d) => dirty.set(dkey("docs", d.id), { deleted: false, seq: ++seq }));
    st.catalog.forEach((c) => dirty.set(dkey("catalog", c.id), { deleted: false, seq: ++seq }));
    if (st.clients.length || st.docs.length || st.catalog.length) dirty.set(dkey("settings", "me"), { deleted: false, seq: ++seq });
    saveDirty();
    lsSet(`soto:migrated:${userId}`, "1");
  }

  set({ status: "syncing" });
  await pull();
  await push();

  channel?.unsubscribe();
  channel = supabase
    .channel("soto-changes")
    .on("postgres_changes", { event: "*", schema: "public" }, () => schedulePull())
    .subscribe();
  if (interval) clearInterval(interval);
  interval = setInterval(() => { void pull(); void push(); }, 60_000);
}

function onSignedOut() {
  uidNow = "";
  channel?.unsubscribe();
  channel = null;
  if (interval) clearInterval(interval);
  set({ signedIn: false, email: "", ready: true, status: "idle", pending: 0 });
}

/** Call once at app start. */
export function startSync() {
  if (started || !supabase) return;
  started = true;
  onChange((c) => { if (uidNow) markDirty(c.table, c.id, c.deleted); });
  const kick = () => { if (uidNow) { void push(); schedulePull(100); } };
  window.addEventListener("online", kick);
  window.addEventListener("focus", kick);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") kick(); });

  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      // defer: Supabase forbids awaiting other client calls inside this callback
      setTimeout(() => void onSession(session.user.id, session.user.email ?? ""), 0);
    } else if (event === "SIGNED_OUT") onSignedOut();
  });
  void supabase.auth.getSession().then(({ data }) => {
    if (!data.session) onSignedOut();
  });
}

// ---------- auth actions ----------
const es = (m: string) =>
  /invalid login/i.test(m) ? "Email o contraseña incorrectos."
  : /already registered|already been registered/i.test(m) ? "Ese email ya tiene cuenta. Prueba a entrar."
  : /password.*(least|short)/i.test(m) ? "La contraseña debe tener al menos 6 caracteres."
  : /email not confirmed/i.test(m) ? "Confirma tu email (te hemos enviado un enlace) y vuelve a entrar."
  : /rate limit/i.test(m) ? "Demasiados intentos. Espera unos minutos."
  : /fetch|network/i.test(m) ? "Sin conexión."
  : m;

export async function signIn(email: string, password: string): Promise<string> {
  const { error } = await supabase!.auth.signInWithPassword({ email, password });
  return error ? es(error.message) : "";
}

export async function signUp(email: string, password: string): Promise<{ error: string; needsConfirm: boolean }> {
  const { data, error } = await supabase!.auth.signUp({ email, password });
  if (error) return { error: es(error.message), needsConfirm: false };
  return { error: "", needsConfirm: !data.session };
}

/** Returns "" on success, or a message if edits are still waiting to be uploaded (nothing is wiped then). */
export async function signOut(): Promise<string> {
  await push().catch(() => {}); // try to flush pending edits first
  if (dirty.size > 0) return "Hay cambios sin subir (¿sin conexión?). Conéctate y espera a que se sincronicen antes de cerrar sesión.";
  resetLocal();
  dirty = new Map();
  saveDirty();
  try { localStorage.removeItem("soto:uid"); } catch {}
  await supabase!.auth.signOut();
  return "";
}
