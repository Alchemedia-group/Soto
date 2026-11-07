"use client";
import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { addClient, blankLine, bumpCatalogUse, cancelInvoice, deleteDoc, findCatalogByName, quoteToInvoice, saveLineToCatalog, updateDoc, useStore } from "@/lib/store";
import { docNumber, fmtDate, money, phoneForWhatsApp, totals } from "@/lib/format";
import { DOC_LABEL, STATUSES_BY_TYPE, STATUS_LABEL, type Line } from "@/lib/types";
import { NumInput } from "@/components/NumInput";
import { StatusBadge, isOverdue } from "@/components/DocBits";
import { Icon } from "@/components/Icon";
import { ReminderButtons } from "@/components/Reminder";
import { LineDescription } from "@/components/LineDescription";

const VATS = [21, 10, 4, 0];

export default function Documento() {
  const { id } = useParams<{ id: string }>();
  const { ready, docs, clients, settings, catalog } = useStore();
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [release, setRelease] = useState(true);
  if (!ready) return null;
  const d = docs.find((x) => x.id === id);
  if (!d) return <div className="empty">Documento no encontrado. <Link href="/"><u>Inicio</u></Link></div>;

  const client = clients.find((c) => c.id === d.clientId);
  const t = totals(d);
  const label = DOC_LABEL[d.type];
  const setLine = (lid: string, patch: Partial<Line>) =>
    updateDoc(d.id, { lines: d.lines.map((l) => (l.id === lid ? { ...l, ...patch } : l)) });
  const linkedInvoice = d.type === "quote" ? docs.find((x) => x.fromQuoteId === d.id && x.status !== "cancelled") : undefined;
  const fromQuote = d.fromQuoteId ? docs.find((x) => x.id === d.fromQuoteId) : undefined;
  const locked = d.type === "invoice" && d.status !== "draft" && !d.cancelled?.released; // issued invoices: keep numbering intact
  const isCancelled = d.status === "cancelled";
  const fromQuoteDoc = d.fromQuoteId ? docs.find((x) => x.id === d.fromQuoteId) : undefined;

  const msg = `Hola${client ? " " + client.name : ""}, te envío ${d.type === "quote" ? "el presupuesto" : "la factura"} ${d.number} de ${settings.companyName} por importe de ${money(t.total)}.`;
  const wa = `https://wa.me/${phoneForWhatsApp(client?.phone ?? "")}?text=${encodeURIComponent(msg)}`;
  const mail = `mailto:${client?.email ?? ""}?subject=${encodeURIComponent(`${label} ${d.number} – ${settings.companyName}`)}&body=${encodeURIComponent(msg)}`;

  return (
    <div className="stack">
      <div className="row between wrap">
        <div>
          <h1>{label} {docNumber(d)}</h1>
          <div className="row"><StatusBadge doc={d} />
            {fromQuote && <Link className="muted" href={`/documentos/${fromQuote.id}`}>desde {docNumber(fromQuote)}</Link>}
            {linkedInvoice && <Link className="muted" href={`/documentos/${linkedInvoice.id}`}>→ {docNumber(linkedInvoice)}</Link>}
          </div>
        </div>
        <div className="row wrap">
          <Link className="btn" href={`/documentos/${d.id}/imprimir`}>PDF / Imprimir</Link>
          <a className="btn" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>
          {client?.email && <a className="btn" href={mail}>Email</a>}
        </div>
      </div>

      {isCancelled && (
        <div className="card" style={{ borderColor: "var(--danger)" }}>
          <strong>Factura anulada</strong>
          <div className="muted">
            {d.cancelled?.released
              ? `El cliente no siguió adelante. El número ${d.cancelled.formerNumber} quedó libre y se usará en la siguiente factura.`
              : `El cliente no siguió adelante. Conserva su número ${d.number} (ya se había enviado): pide a tu gestor la factura rectificativa.`}
          </div>
        </div>
      )}

      {cancelling && d.type === "invoice" && d.status === "sent" && (
        <div className="card stack" style={{ borderColor: "var(--danger)" }}>
          <div><strong>Anular la factura {d.number}</strong><div className="muted">El cliente no sigue adelante. ¿Se llegó a entregar esta factura?</div></div>
          <label style={{ display: "flex", gap: ".6rem", alignItems: "flex-start", color: "var(--text)", fontSize: "1rem" }}>
            <input type="radio" style={{ width: 24, minHeight: 24 }} checked={release} onChange={() => setRelease(true)} />
            <span><strong>No, nunca salió de aquí.</strong> Libero el número {d.number}: lo usará la siguiente factura real.</span>
          </label>
          <label style={{ display: "flex", gap: ".6rem", alignItems: "flex-start", color: "var(--text)", fontSize: "1rem" }}>
            <input type="radio" style={{ width: 24, minHeight: 24 }} checked={!release} onChange={() => setRelease(false)} />
            <span><strong>Sí, ya se la envié.</strong> Queda anulada y conserva su número (la ley exige numeración correlativa sin repetir); tu gestor emitirá la rectificativa.</span>
          </label>
          {fromQuoteDoc && fromQuoteDoc.status === "accepted" && <div className="muted">El presupuesto {fromQuoteDoc.number} pasará a “Rechazado”.</div>}
          <div className="row wrap">
            <button className="btn danger" onClick={() => { cancelInvoice(d.id, release); setCancelling(false); }}>Anular factura</button>
            <button className="btn" onClick={() => setCancelling(false)}>Volver</button>
          </div>
        </div>
      )}

      {d.type === "quote" && d.status === "accepted" && !linkedInvoice && (
        <div className="card" style={{ borderColor: "var(--brand)", background: "var(--brand-l)" }}>
          <div className="row between wrap">
            <div><strong>El cliente ha aceptado este presupuesto.</strong><div className="muted">Pásalo a factura con un toque; se copian los conceptos, el IVA y el cliente.</div></div>
            <button className="btn primary" onClick={() => router.push(`/documentos/${quoteToInvoice(d.id)!.id}`)}>Crear factura</button>
          </div>
        </div>
      )}

      {d.type === "invoice" && d.status === "sent" && (
        <div className="card" style={isOverdue(d) ? { borderColor: "var(--warn)" } : undefined}>
          <div className="row between wrap">
            <div>
              <strong>{isOverdue(d) ? "Factura vencida" : "Pendiente de cobro"}</strong>
              <div className="muted">{d.lastReminder ? `Último recordatorio: ${fmtDate(d.lastReminder)}` : "Aún no has enviado ningún recordatorio."}</div>
            </div>
            <div className="row wrap"><ReminderButtons doc={d} client={client} settings={settings} />
              <button className="btn primary" onClick={() => updateDoc(d.id, { status: "paid" })}>Marcar cobrada</button></div>
          </div>
        </div>
      )}

      <div className="card grid g2 keep">
        <div>
          <label>Cliente</label>
          <div className="row">
            <select value={d.clientId} onChange={(e) => updateDoc(d.id, { clientId: e.target.value })}>
              <option value="">— Elegir cliente —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="btn" title="Nuevo cliente" onClick={() => {
              const name = prompt("Nombre del nuevo cliente");
              if (name?.trim()) updateDoc(d.id, { clientId: addClient({ name: name.trim() }).id });
            }}><Icon name="plus" size={18} /></button>
          </div>
        </div>
        <div className="grid g2">
          <div><label>Fecha</label><input type="date" value={d.date} onChange={(e) => updateDoc(d.id, { date: e.target.value })} /></div>
          {d.type === "invoice" && <div><label>Vencimiento</label><input type="date" value={d.dueDate} onChange={(e) => updateDoc(d.id, { dueDate: e.target.value })} /></div>}
        </div>
      </div>

      <div className="card">
        <h2>Conceptos</h2>
        {d.lines.map((l) => (
          <div className="line" key={l.id}>
            <div className="desc"><label>Descripción</label>
              <LineDescription
                value={l.description}
                catalog={catalog}
                onText={(t) => setLine(l.id, { description: t })}
                onPick={(it) => { setLine(l.id, { description: it.name, price: it.price, vat: it.vat }); bumpCatalogUse(it.id); }}
              />
              {(() => {
                if (!l.description.trim()) return null;
                const saved = findCatalogByName(l.description, catalog);
                if (saved && saved.price === l.price && saved.vat === l.vat) return <div className="muted" style={{ fontSize: ".75rem", marginTop: 4 }}>✓ Guardado en el catálogo</div>;
                return (
                  <div className="row wrap" style={{ marginTop: 6 }}>
                    <button type="button" className="btn sm" onClick={() => saveLineToCatalog(l)}>
                      {saved ? "Actualizar el catálogo con este precio" : "Guardar en el catálogo"}
                    </button>
                    {saved && d.status === "draft" && (
                      <button type="button" className="btn sm" onClick={() => setLine(l.id, { price: saved.price, vat: saved.vat })}>
                        Usar el precio actual del catálogo ({money(saved.price)})
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
            <div><label>Cant.</label><NumInput value={l.qty} onChange={(n) => setLine(l.id, { qty: n })} /></div>
            <div><label>Precio (sin IVA)</label><NumInput value={l.price} onChange={(n) => setLine(l.id, { price: n })} /></div>
            <div><label>IVA</label>
              <select value={l.vat} onChange={(e) => setLine(l.id, { vat: Number(e.target.value) })}>
                {[...new Set([...VATS, l.vat])].map((v) => <option key={v} value={v}>{v}%</option>)}
              </select></div>
            <button className="btn sm del" aria-label="Quitar línea" disabled={d.lines.length === 1}
              onClick={() => updateDoc(d.id, { lines: d.lines.filter((x) => x.id !== l.id) })}><Icon name="trash" size={16} /></button>
          </div>
        ))}
        <div style={{ marginTop: ".8rem" }}>
          <button className="btn" onClick={() => updateDoc(d.id, { lines: [...d.lines, blankLine()] })}><Icon name="plus" size={18} /> Añadir concepto</button>
        </div>

        <div className="totals" style={{ marginTop: "1rem" }}>
          <div><span className="muted">Base imponible</span><span>{money(t.base)}</span></div>
          {t.byRate.map((r) => <div key={r.rate}><span className="muted">IVA {r.rate}%</span><span>{money(r.vat)}</span></div>)}
          {d.irpf > 0 && <div><span className="muted">Retención IRPF {d.irpf}%</span><span>−{money(t.irpf)}</span></div>}
          <div className="big"><span>Total</span><span>{money(t.total)}</span></div>
        </div>
        <div style={{ maxWidth: 160, marginTop: ".8rem" }}>
          <label>Retención IRPF %</label>
          <NumInput value={d.irpf} onChange={(n) => updateDoc(d.id, { irpf: n })} />
        </div>
      </div>

      <div className="card">
        <label>Notas / condiciones</label>
        <textarea value={d.notes} placeholder="Validez del presupuesto, forma de pago, garantía…" onChange={(e) => updateDoc(d.id, { notes: e.target.value })} />
      </div>

      <div className="card">
        <h2>Estado</h2>
        {isCancelled ? <div className="muted">Anulada: ya no se puede cambiar su estado.</div> : (
          <div className="chips">
            {STATUSES_BY_TYPE[d.type].map((s) => (
              <button key={s} className={`chip ${d.status === s ? "on" : ""}`} onClick={() => updateDoc(d.id, { status: s })}>{STATUS_LABEL[s]}</button>
            ))}
          </div>
        )}
        <div className="row wrap" style={{ marginTop: ".8rem" }}>
          {d.type === "quote" && (
            linkedInvoice
              ? <Link className="btn" href={`/documentos/${linkedInvoice.id}`}>Ver factura {docNumber(linkedInvoice)}</Link>
              : <button className="btn primary" onClick={() => router.push(`/documentos/${quoteToInvoice(d.id)!.id}`)}>Convertir en factura</button>
          )}
          {d.type === "invoice" && d.status === "sent" && !cancelling && <button className="btn danger" onClick={() => setCancelling(true)}>Anular factura</button>}
          <button className="btn danger" onClick={() => {
            if (locked) { alert("Una factura emitida no se puede eliminar para mantener la numeración correlativa. Si el cliente no sigue adelante, usa “Anular factura”."); return; }
            if (confirm(d.type === "invoice" && d.number ? `¿Eliminar ${d.number}? Su número quedará libre para la siguiente factura.` : `¿Eliminar ${docNumber(d)}?`)) { deleteDoc(d.id); router.push(d.type === "quote" ? "/presupuestos" : "/facturas"); }
          }}>Eliminar</button>
        </div>
        <p className="muted" style={{ fontSize: ".8rem", marginBottom: 0 }}>Fecha: {fmtDate(d.date)}</p>
      </div>
    </div>
  );
}
