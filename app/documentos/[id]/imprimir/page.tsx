"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { fmtDate, money, totals } from "@/lib/format";
import { DOC_LABEL } from "@/lib/types";

export default function Imprimir() {
  const { id } = useParams<{ id: string }>();
  const { ready, docs, clients, settings: s } = useStore();
  if (!ready) return null;
  const d = docs.find((x) => x.id === id);
  if (!d) return <div className="empty">Documento no encontrado.</div>;
  const c = clients.find((x) => x.id === d.clientId);
  const t = totals(d);

  return (
    <div className="stack">
      <div className="row between no-print">
        <Link className="btn" href={`/documentos/${d.id}`}>← Volver</Link>
        <button className="btn primary" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
      </div>
      <div className="paper">
        <div className="row between" style={{ alignItems: "flex-start" }}>
          <div>
            <h1 style={{ margin: 0 }}>{s.companyName}</h1>
            <div style={{ whiteSpace: "pre-line", fontSize: ".9rem" }}>
              {[s.nif && `NIF: ${s.nif}`, s.address, s.phone, s.email].filter(Boolean).join("\n")}
            </div>
          </div>
          <div className="right">
            <h2 style={{ margin: 0, textTransform: "uppercase" }}>{DOC_LABEL[d.type]}</h2>
            <div><strong>{d.number}</strong></div>
            <div>Fecha: {fmtDate(d.date)}</div>
            {d.type === "invoice" && d.dueDate && <div>Vencimiento: {fmtDate(d.dueDate)}</div>}
          </div>
        </div>

        <div style={{ margin: "1.5rem 0", padding: ".8rem", background: "#f5f5f5", borderRadius: 6 }}>
          <strong>{c?.name ?? "—"}</strong>
          <div style={{ whiteSpace: "pre-line", fontSize: ".9rem" }}>
            {[c?.nif && `NIF: ${c.nif}`, c?.address, c?.phone, c?.email].filter(Boolean).join("\n")}
          </div>
        </div>

        <table>
          <thead><tr><th>Concepto</th><th className="r">Cant.</th><th className="r">Precio</th><th className="r">IVA</th><th className="r">Importe</th></tr></thead>
          <tbody>
            {d.lines.filter((l) => l.description || l.price).map((l) => (
              <tr key={l.id}>
                <td>{l.description}</td><td className="r">{l.qty}</td><td className="r">{money(l.price)}</td>
                <td className="r">{l.vat}%</td><td className="r">{money(l.qty * l.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="totals" style={{ marginTop: "1rem" }}>
          <div><span>Base imponible</span><span>{money(t.base)}</span></div>
          {t.byRate.map((r) => <div key={r.rate}><span>IVA {r.rate}% s/ {money(r.base)}</span><span>{money(r.vat)}</span></div>)}
          {d.irpf > 0 && <div><span>Retención IRPF {d.irpf}%</span><span>−{money(t.irpf)}</span></div>}
          <div className="big"><span>TOTAL</span><span>{money(t.total)}</span></div>
        </div>

        {d.type === "invoice" && s.iban && <p style={{ marginTop: "1.5rem" }}><strong>Forma de pago:</strong> transferencia a {s.iban}</p>}
        {d.notes && <p style={{ whiteSpace: "pre-line", marginTop: "1rem" }}>{d.notes}</p>}
        {s.footer && <p style={{ marginTop: "2rem", fontSize: ".8rem", color: "#666", whiteSpace: "pre-line" }}>{s.footer}</p>}
      </div>
    </div>
  );
}
