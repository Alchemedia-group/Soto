"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addClient, clientName, useStore } from "@/lib/store";
import { fmtDate, money, totals } from "@/lib/format";
import { DOC_LABEL } from "@/lib/types";
import { NewDocButton, StatusBadge, isOverdue } from "@/components/DocBits";

export default function Dashboard() {
  const { ready, docs, clients } = useStore();
  const router = useRouter();
  if (!ready) return null;

  const month = new Date().toISOString().slice(0, 7);
  const invoices = docs.filter((d) => d.type === "invoice");
  const pending = invoices.filter((d) => d.status === "sent");
  const overdue = pending.filter(isOverdue);
  const sum = (arr: typeof docs) => arr.reduce((s, d) => s + totals(d).total, 0);
  const monthBilled = invoices.filter((d) => d.status !== "draft" && d.date.startsWith(month));
  const openQuotes = docs.filter((d) => d.type === "quote" && d.status === "sent");
  const recent = docs.slice(0, 6);

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

      <div className="card">
        <h2>Últimos documentos</h2>
        {recent.length === 0 ? (
          <div className="empty">Aún no hay nada. Crea tu primer presupuesto o dícteselo al asistente.</div>
        ) : (
          <div className="list">
            {recent.map((d) => (
              <Link key={d.id} href={`/documentos/${d.id}`}>
                <div>
                  <strong>{d.number}</strong> <span className="muted">· {DOC_LABEL[d.type]}</span>
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
