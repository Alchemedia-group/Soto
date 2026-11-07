"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { exportData, importData, updateSettings, useStore } from "@/lib/store";
import { NumInput } from "@/components/NumInput";
import { push, pull, signOut, useSync } from "@/lib/sync";
import { fmtDate } from "@/lib/format";
import type { Settings } from "@/lib/types";

export default function Ajustes() {
  const { ready, settings: s, catalog } = useStore();
  const sync = useSync();
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  if (!ready) return null;
  const txt = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    updateSettings({ [k]: e.target.value });

  const status =
    !sync.enabled ? "Solo en este dispositivo (la base de datos compartida no está configurada)."
    : sync.status === "offline" ? "Sin conexión. Tus cambios se subirán al recuperar la conexión."
    : sync.status === "error" ? `Error de sincronización: ${sync.error}`
    : sync.status === "syncing" || sync.pending ? "Sincronizando…"
    : sync.lastSync ? `Sincronizado · ${new Date(sync.lastSync).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`
    : "Sincronizado";

  return (
    <div className="stack">
      <h1>Ajustes</h1>

      <div className="card stack">
        <div>
          <h2 style={{ marginBottom: 0 }}>Datos de la empresa</h2>
          <p className="muted" style={{ margin: 0 }}>Aparecen en la cabecera de tus presupuestos y facturas. Si cambias de dirección o teléfono, edítalo aquí: los documentos nuevos y al imprimir los antiguos usarán los datos actuales.</p>
        </div>
        <div className="grid g2 keep">
          <div style={{ gridColumn: "1 / -1" }}><label>Nombre de la empresa</label><input value={s.companyName} onChange={txt("companyName")} /></div>
          <div><label>NIF / CIF</label><input value={s.nif} onChange={txt("nif")} /></div>
          <div><label>Teléfono</label><input type="tel" value={s.phone} onChange={txt("phone")} /></div>
          <div><label>Email</label><input type="email" value={s.email} onChange={txt("email")} /></div>
          <div><label>IBAN (para cobros)</label><input value={s.iban} onChange={txt("iban")} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label>Dirección</label><textarea value={s.address} onChange={txt("address")} placeholder={"Calle, número\nCódigo postal, localidad"} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label>Pie de documentos (registro mercantil, protección de datos…)</label><textarea value={s.footer} onChange={txt("footer")} /></div>
        </div>
      </div>

      <div className="card stack">
        <h2 style={{ marginBottom: 0 }}>Facturación</h2>
        <div className="grid g3">
          <div><label>IVA por defecto %</label><NumInput value={s.defaultVat} onChange={(n) => updateSettings({ defaultVat: n })} /></div>
          <div><label>IRPF por defecto %</label><NumInput value={s.defaultIrpf} onChange={(n) => updateSettings({ defaultIrpf: n })} /></div>
          <div><label>Plazo de pago (días)</label><NumInput value={s.paymentDays} onChange={(n) => updateSettings({ paymentDays: n })} /></div>
          <div><label>Prefijo presupuestos</label><input value={s.quotePrefix} onChange={txt("quotePrefix")} /></div>
          <div><label>Prefijo facturas</label><input value={s.invoicePrefix} onChange={txt("invoicePrefix")} /></div>
        </div>
        <Link href="/catalogo" className="btn">Catálogo de servicios y productos ({catalog.length})</Link>
      </div>

      <div className="card stack">
        <h2 style={{ marginBottom: 0 }}>Cuenta y sincronización</h2>
        {sync.enabled && sync.signedIn && <div>Sesión iniciada como <strong>{sync.email}</strong></div>}
        <div className="muted">{status}{sync.pending ? ` (${sync.pending} cambios pendientes)` : ""}</div>
        {sync.enabled && sync.signedIn && (
          <div className="row wrap">
            <button className="btn" onClick={async () => { await push(); await pull(); }}>Sincronizar ahora</button>
            <button className="btn danger" onClick={async () => { const e = await signOut(); if (e) setMsg(e); }}>Cerrar sesión</button>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Copia de seguridad</h2>
        <p className="muted">Además de la sincronización, puedes descargar una copia de todo tu negocio en un archivo.</p>
        <div className="row wrap">
          <button className="btn" onClick={() => {
            const url = URL.createObjectURL(new Blob([exportData()], { type: "application/json" }));
            const a = document.createElement("a");
            a.href = url; a.download = `soto-copia-${new Date().toISOString().slice(0, 10)}.json`; a.click();
            URL.revokeObjectURL(url);
          }}>Descargar copia</button>
          <button className="btn" onClick={() => file.current?.click()}>Restaurar copia…</button>
          <input ref={file} type="file" accept="application/json" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            if (!confirm("Esto reemplaza todos los datos actuales (también en tus otros dispositivos). ¿Continuar?")) { e.target.value = ""; return; }
            try { importData(await f.text()); setMsg("Copia restaurada."); } catch { setMsg("El archivo no es válido."); }
            e.target.value = "";
          }} />
        </div>
      </div>
      {msg && <div role="status" className="card">{msg}</div>}
      <p className="muted" style={{ fontSize: ".8rem" }}>Última sincronización: {sync.lastSync ? fmtDate(sync.lastSync.slice(0, 10)) : "—"}</p>
    </div>
  );
}
