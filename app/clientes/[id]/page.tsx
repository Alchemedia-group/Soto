"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { deleteClient, updateClient, useStore } from "@/lib/store";
import { docNumber, fmtDate, money, totals } from "@/lib/format";
import { NewDocButton, StatusBadge } from "@/components/DocBits";
import type { Doc } from "@/lib/types";

export default function ClienteDetalle() {
  const { id } = useParams<{ id: string }>();
  const { ready, clients, docs } = useStore();
  const router = useRouter();
  if (!ready) return null;
  const c = clients.find((x) => x.id === id);
  if (!c) return <div className="empty">Cliente no encontrado. <Link href="/clientes"><u>Volver</u></Link></div>;
  const mine = docs.filter((d) => d.clientId === c.id);
  const byDate = (a: Doc, b: Doc) => b.date.localeCompare(a.date) || docNumber(b).localeCompare(docNumber(a));
  const quotes = mine.filter((d) => d.type === "quote").sort(byDate);
  const invoices = mine.filter((d) => d.type === "invoice").sort(byDate);
  const sum = (arr: Doc[]) => arr.reduce((n, d) => n + totals(d).total, 0);
  const billed = sum(invoices.filter((d) => d.status !== "draft" && d.status !== "cancelled"));
  const pending = sum(invoices.filter((d) => d.status === "sent"));
  const set = (k: keyof typeof c) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    updateClient(c.id, { [k]: e.target.value });

  return (
    <div className="stack">
      <div className="row between wrap">
        <h1>{c.name}</h1>
        <div className="row wrap">
          <NewDocButton type="quote" clientId={c.id} />
          <NewDocButton type="invoice" clientId={c.id} primary={false} />
        </div>
      </div>
      <div className="card grid g2 keep">
        <div><label>Nombre / razón social</label><input value={c.name} onChange={set("name")} /></div>
        <div><label>NIF / CIF</label><input value={c.nif} onChange={set("nif")} /></div>
        <div><label>Teléfono</label><input type="tel" value={c.phone} onChange={set("phone")} /></div>
        <div><label>Email</label><input type="email" value={c.email} onChange={set("email")} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label>Dirección</label><input value={c.address} onChange={set("address")} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label>Notas</label><textarea value={c.notes} onChange={set("notes")} /></div>
      </div>
      <div className="card">
        <div className="row between wrap"><h2 style={{ marginBottom: 0 }}>Presupuestos ({quotes.length})</h2><NewDocButton type="quote" clientId={c.id} primary={false} /></div>
        {quotes.length === 0 ? <div className="empty">Sin presupuestos.</div> : <DocRows docs={quotes} />}
      </div>

      <div className="card">
        <div className="row between wrap">
          <h2 style={{ marginBottom: 0 }}>Facturas ({invoices.length})</h2>
          <NewDocButton type="invoice" clientId={c.id} primary={false} />
        </div>
        {invoices.length > 0 && (
          <div className="muted" style={{ margin: ".4rem 0" }}>
            Facturado {money(billed)} · Pendiente de cobro <strong style={{ color: pending ? "var(--warn)" : undefined }}>{money(pending)}</strong>
          </div>
        )}
        {invoices.length === 0 ? <div className="empty">Sin facturas.</div> : <DocRows docs={invoices} />}
      </div>

      <button className="btn danger" onClick={() => {
        if (confirm(mine.length ? `${c.name} tiene ${mine.length} documento(s); seguirán existiendo sin cliente. ¿Eliminar?` : `¿Eliminar a ${c.name}?`)) {
          deleteClient(c.id); router.push("/clientes");
        }
      }}>Eliminar cliente</button>
    </div>
  );
}

function DocRows({ docs }: { docs: Doc[] }) {
  return (
    <div className="list">
      {docs.map((d) => (
        <Link key={d.id} href={`/documentos/${d.id}`} style={d.status === "cancelled" ? { opacity: 0.6 } : undefined}>
          <div><strong>{docNumber(d)}</strong> <span className="muted">· {fmtDate(d.date)}</span></div>
          <div className="right"><strong>{money(totals(d).total)}</strong> <StatusBadge doc={d} /></div>
        </Link>
      ))}
    </div>
  );
}
