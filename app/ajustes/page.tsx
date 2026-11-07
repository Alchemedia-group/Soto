"use client";
import { useRef, useState } from "react";
import { exportData, importData, updateSettings, useStore } from "@/lib/store";
import { NumInput } from "@/components/NumInput";
import type { Settings } from "@/lib/types";

export default function Ajustes() {
  const { ready, settings: s } = useStore();
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  if (!ready) return null;
  const txt = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    updateSettings({ [k]: e.target.value });

  return (
    <div className="stack">
      <h1>Ajustes</h1>
      <div className="card grid g2 keep">
        <div style={{ gridColumn: "1 / -1" }}><label>Nombre de la empresa</label><input value={s.companyName} onChange={txt("companyName")} /></div>
        <div><label>NIF / CIF</label><input value={s.nif} onChange={txt("nif")} /></div>
        <div><label>Teléfono</label><input type="tel" value={s.phone} onChange={txt("phone")} /></div>
        <div><label>Email</label><input type="email" value={s.email} onChange={txt("email")} /></div>
        <div><label>IBAN (para cobros)</label><input value={s.iban} onChange={txt("iban")} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label>Dirección</label><input value={s.address} onChange={txt("address")} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label>Pie de documentos (registro mercantil, LOPD…)</label><textarea value={s.footer} onChange={txt("footer")} /></div>
      </div>
      <div className="card grid g3">
        <div><label>IVA por defecto %</label><NumInput value={s.defaultVat} onChange={(n) => updateSettings({ defaultVat: n })} /></div>
        <div><label>IRPF por defecto %</label><NumInput value={s.defaultIrpf} onChange={(n) => updateSettings({ defaultIrpf: n })} /></div>
        <div><label>Plazo de pago (días)</label><NumInput value={s.paymentDays} onChange={(n) => updateSettings({ paymentDays: n })} /></div>
        <div><label>Prefijo presupuestos</label><input value={s.quotePrefix} onChange={txt("quotePrefix")} /></div>
        <div><label>Prefijo facturas</label><input value={s.invoicePrefix} onChange={txt("invoicePrefix")} /></div>
      </div>

      <div className="card">
        <h2>Copia de seguridad</h2>
        <p className="muted">Por ahora los datos se guardan solo en este dispositivo. Descarga una copia con frecuencia, y úsala para pasar los datos a otro móvil u ordenador.</p>
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
            if (!confirm("Esto reemplaza todos los datos actuales. ¿Continuar?")) { e.target.value = ""; return; }
            try { importData(await f.text()); setMsg("Copia restaurada."); } catch { setMsg("El archivo no es válido."); }
            e.target.value = "";
          }} />
        </div>
        {msg && <p>{msg}</p>}
      </div>
    </div>
  );
}
