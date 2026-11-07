"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { addDays, docNumber, fmtDate, money, totals } from "@/lib/format";
import { DOC_LABEL } from "@/lib/types";

export default function Imprimir() {
  const { id } = useParams<{ id: string }>();
  const { ready, docs, clients, settings: s } = useStore();
  if (!ready) return null;
  const d = docs.find((x) => x.id === id);
  if (!d) return <div className="empty">Documento no encontrado.</div>;
  const c = clients.find((x) => x.id === d.clientId);
  const t = totals(d);
  const isInvoice = d.type === "invoice";
  const lines = (txt: (string | false | undefined)[]) => txt.filter(Boolean).join("\n");

  return (
    <div className="stack">
      <div className="row between no-print">
        <Link className="btn" href={`/documentos/${d.id}`}>← Volver</Link>
        <button className="btn primary" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
      </div>

      <div className="paper">
        <div className="row between" style={{ alignItems: "flex-start" }}>
          <div className="doc-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt={s.companyName} />
          </div>
          <div className="right" style={{ fontSize: ".85em" }}>
            {lines([s.companyName, s.nif && `NIF ${s.nif}`, s.address, s.phone, s.email]).split("\n").map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>

        <div className="doc-band" style={{ margin: "1.2rem 0" }}>
          <span>{DOC_LABEL[d.type].toUpperCase()}</span>
          <span>{d.status === "cancelled" ? "ANULADA · " : ""}{docNumber(d)}</span>
        </div>

        <div className="row" style={{ alignItems: "stretch", gap: "1rem", flexWrap: "wrap" }}>
          <div className="box grow" style={{ minWidth: 220 }}>
            <div className="lbl">Cliente</div>
            <strong>{c?.name ?? "—"}</strong>
            <div style={{ whiteSpace: "pre-line", fontSize: ".9em" }}>{lines([c?.nif && `NIF ${c.nif}`, c?.address, c?.phone, c?.email])}</div>
          </div>
          <div className="box" style={{ minWidth: 200 }}>
            <div className="lbl">Fecha</div><div>{fmtDate(d.date)}</div>
            {isInvoice ? (
              <><div className="lbl" style={{ marginTop: ".5rem" }}>Vencimiento</div><div>{fmtDate(d.dueDate)}</div></>
            ) : (
              <><div className="lbl" style={{ marginTop: ".5rem" }}>Válido hasta</div><div>{fmtDate(addDays(d.date, 30))}</div></>
            )}
          </div>
        </div>

        <table style={{ marginTop: "1.2rem" }}>
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

        {isInvoice ? (
          <div className="box" style={{ marginTop: "1.5rem" }}>
            <div className="lbl">Forma de pago</div>
            {s.iban ? <div>Transferencia bancaria a <strong>{s.iban}</strong></div> : <div>Transferencia bancaria</div>}
            <div style={{ fontSize: ".9em" }}>Indica el número de factura <strong>{d.number}</strong> en el concepto. Vencimiento: {fmtDate(d.dueDate)}.</div>
          </div>
        ) : (
          <div className="row" style={{ gap: "1.5rem", marginTop: "1.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="grow" style={{ minWidth: 200, fontSize: ".85em" }}>
              Presupuesto válido 30 días desde su fecha. Los precios no incluyen IVA salvo que se indique.
            </div>
            <div style={{ width: 260 }}>
              <div className="sign" />
              <div className="lbl" style={{ marginTop: ".3rem" }}>Aceptado por el cliente · firma y fecha</div>
            </div>
          </div>
        )}

        {d.notes && <p style={{ whiteSpace: "pre-line", marginTop: "1rem", fontSize: ".9em" }}>{d.notes}</p>}
        {s.footer && <p style={{ marginTop: "1rem", fontSize: ".75em", color: "#666", whiteSpace: "pre-line" }}>{s.footer}</p>}
        <div className="services">Fontanería · Clima · Electricidad · Fotovoltaica</div>
      </div>
    </div>
  );
}
