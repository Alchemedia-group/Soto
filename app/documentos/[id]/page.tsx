"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { addClient, blankLine, deleteDoc, quoteToInvoice, updateDoc, useStore } from "@/lib/store";
import { fmtDate, money, phoneForWhatsApp, totals } from "@/lib/format";
import { DOC_LABEL, STATUSES_BY_TYPE, STATUS_LABEL, type Line } from "@/lib/types";
import { NumInput } from "@/components/NumInput";
import { StatusBadge } from "@/components/DocBits";
import { Icon } from "@/components/Icon";

const VATS = [21, 10, 4, 0];

export default function Documento() {
  const { id } = useParams<{ id: string }>();
  const { ready, docs, clients, settings } = useStore();
  const router = useRouter();
  if (!ready) return null;
  const d = docs.find((x) => x.id === id);
  if (!d) return <div className="empty">Documento no encontrado. <Link href="/"><u>Inicio</u></Link></div>;

  const client = clients.find((c) => c.id === d.clientId);
  const t = totals(d);
  const label = DOC_LABEL[d.type];
  const setLine = (lid: string, patch: Partial<Line>) =>
    updateDoc(d.id, { lines: d.lines.map((l) => (l.id === lid ? { ...l, ...patch } : l)) });
  const linkedInvoice = d.type === "quote" ? docs.find((x) => x.fromQuoteId === d.id) : undefined;
  const fromQuote = d.fromQuoteId ? docs.find((x) => x.id === d.fromQuoteId) : undefined;
  const locked = d.type === "invoice" && d.status !== "draft"; // issued invoices: keep numbering intact

  const msg = `Hola${client ? " " + client.name : ""}, te envío ${d.type === "quote" ? "el presupuesto" : "la factura"} ${d.number} de ${settings.companyName} por importe de ${money(t.total)}.`;
  const wa = `https://wa.me/${phoneForWhatsApp(client?.phone ?? "")}?text=${encodeURIComponent(msg)}`;
  const mail = `mailto:${client?.email ?? ""}?subject=${encodeURIComponent(`${label} ${d.number} – ${settings.companyName}`)}&body=${encodeURIComponent(msg)}`;

  return (
    <div className="stack">
      <div className="row between wrap">
        <div>
          <h1>{label} {d.number}</h1>
          <div className="row"><StatusBadge doc={d} />
            {fromQuote && <Link className="muted" href={`/documentos/${fromQuote.id}`}>desde {fromQuote.number}</Link>}
            {linkedInvoice && <Link className="muted" href={`/documentos/${linkedInvoice.id}`}>→ {linkedInvoice.number}</Link>}
          </div>
        </div>
        <div className="row wrap">
          <Link className="btn" href={`/documentos/${d.id}/imprimir`}>PDF / Imprimir</Link>
          <a className="btn" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>
          {client?.email && <a className="btn" href={mail}>Email</a>}
        </div>
      </div>

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
              <input value={l.description} placeholder="Ej. Instalación de caldera" onChange={(e) => setLine(l.id, { description: e.target.value })} /></div>
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
        <div className="chips">
          {STATUSES_BY_TYPE[d.type].map((s) => (
            <button key={s} className={`chip ${d.status === s ? "on" : ""}`} onClick={() => updateDoc(d.id, { status: s })}>{STATUS_LABEL[s]}</button>
          ))}
        </div>
        <div className="row wrap" style={{ marginTop: ".8rem" }}>
          {d.type === "quote" && (
            linkedInvoice
              ? <Link className="btn" href={`/documentos/${linkedInvoice.id}`}>Ver factura {linkedInvoice.number}</Link>
              : <button className="btn primary" onClick={() => router.push(`/documentos/${quoteToInvoice(d.id)!.id}`)}>Convertir en factura</button>
          )}
          <button className="btn danger" onClick={() => {
            if (locked) { alert("Una factura emitida no se puede eliminar para mantener la numeración correlativa. Pásala a borrador si de verdad quieres borrarla."); return; }
            if (confirm(`¿Eliminar ${d.number}?`)) { deleteDoc(d.id); router.push(d.type === "quote" ? "/presupuestos" : "/facturas"); }
          }}>Eliminar</button>
        </div>
        <p className="muted" style={{ fontSize: ".8rem", marginBottom: 0 }}>Fecha: {fmtDate(d.date)}</p>
      </div>
    </div>
  );
}
