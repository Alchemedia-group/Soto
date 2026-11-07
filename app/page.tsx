"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addClient, clientName, quoteToInvoice, useStore } from "@/lib/store";
import { docNumber, fmtDate, money, totals } from "@/lib/format";
import { DOC_LABEL } from "@/lib/types";
import { NewDocButton, StatusBadge, isOverdue } from "@/components/DocBits";
import { ReminderButtons } from "@/components/Reminder";
import { daysOverdue } from "@/lib/reminder";

export default function Dashboard() {
  const { ready, docs, clients, settings } = useStore();
  const router = useRouter();
  if (!ready) return null;

  const month = new Date().toISOString().slice(0, 7);
  const invoices = docs.filter((d) => d.type === "invoice");
  const pending = invoices.filter((d) => d.status === "sent");
  const overdue = pending.filter(isOverdue);
  const sum = (arr: typeof docs) => arr.reduce((s, d) => s + totals(d).total, 0);
  const monthBilled = invoices.filter((d) => d.status !== "draft" && d.status !== "cancelled" && d.date.startsWith(month));
  const openQuotes = docs.filter((d) => d.type === "quote" && d.status === "sent");
  const recent = docs.slice(0, 6);
  const toInvoice = docs.filter((q) => q.type === "quote" && q.status === "accepted" && !docs.some((i) => i.fromQuoteId === q.id && i.status !== "cancelled"));

  return (
    <div className="stack">
      <div>
        <h1>Hola 👋</h1>
        <p className="muted" style={{ margin: 0 }}>Pulsa el micrófono y dime qué necesitas.</p>
      </div>

      <div className="grid g3">
        <div className="card stat"><div className="n">{money(sum(pending))}</div><div className="l">Pendiente de cobro</div></div>
        <div className="card stat">
          <div className="n" style={{ color: overdue.length ? "var(--warn)" : undefined }}>{money(sum(overdue))}</div>
          <div className="l">Vencido ({overdue.length})</div>
        </div>
        <div className="card stat"><div className="n">{money(sum(monthBilled))}</div><div className="l">Facturado este mes</div></div>
        <div className="card stat"><div className="n">{openQuotes.length}</div><div className="l">Presupuestos sin respuesta</div></div>
        <div className="card stat"><div className="n">{clients.length}</div><div className="l">Clientes</div></div>
      </div>

      <div className="row wrap">
        <NewDocButton type="quote" />
        <NewDocButton type="invoice" primary={false} />
        <button className="btn" onClick={() => router.push(`/clientes/${addClient({ name: "Nuevo cliente" }).id}`)}>Nuevo cliente</button>
      </div>

      {toInvoice.length > 0 && (
        <div className="card">
          <h2>Aceptados, listos para facturar</h2>
          <div className="list">
            {toInvoice.map((q) => (
              <div key={q.id} className="item">
                <Link href={`/documentos/${q.id}`}>
                  <span><strong>{q.number}</strong> <span className="muted">· {clientName(clients, q.clientId)}</span></span>
                </Link>
                <div className="row">
                  <strong>{money(totals(q).total)}</strong>
                  <button className="btn primary sm" onClick={() => router.push(`/documentos/${quoteToInvoice(q.id)!.id}`)}>Crear factura</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {overdue.length > 0 && (
        <div className="card">
          <h2>Recordatorios de pago</h2>
          <div className="list">
            {overdue.slice(0, 5).map((d) => (
              <div key={d.id} className="item" style={{ flexWrap: "wrap" }}>
                <Link href={`/documentos/${d.id}`}>
                  <span>
                    <strong>{clientName(clients, d.clientId)}</strong> <span className="muted">· {d.number}</span>
                    <div style={{ fontSize: ".85rem", color: "var(--warn)" }}>Vencida hace {daysOverdue(d)} días · {money(totals(d).total)}</div>
                  </span>
                </Link>
                <div className="row wrap">
                  <ReminderButtons doc={d} client={clients.find((c) => c.id === d.clientId)} settings={settings} small />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2>Últimos documentos</h2>
        {recent.length === 0 ? (
          <div className="empty">Aún no hay nada. Crea tu primer presupuesto o dícteselo al asistente.</div>
        ) : (
          <div className="list">
            {recent.map((d) => (
              <Link key={d.id} href={`/documentos/${d.id}`}>
                <div>
                  <strong>{docNumber(d)}</strong> <span className="muted">· {DOC_LABEL[d.type]}</span>
                  <div className="muted" style={{ fontSize: ".85rem" }}>{clientName(clients, d.clientId)} · {fmtDate(d.date)}</div>
                </div>
                <div className="right">
                  <div><strong>{money(totals(d).total)}</strong></div>
                  <StatusBadge doc={d} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
