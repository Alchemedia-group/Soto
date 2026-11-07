"use client";
import Link from "next/link";
import { useState } from "react";
import { clientName, useStore } from "@/lib/store";
import { docNumber, fmtDate, money, norm, totals } from "@/lib/format";
import { DOC_LABEL, STATUSES_BY_TYPE, STATUS_LABEL, type DocStatus, type DocType } from "@/lib/types";
import { NewDocButton, StatusBadge } from "./DocBits";

export function DocList({ type }: { type: DocType }) {
  const { ready, docs, clients } = useStore();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<DocStatus | "all">("all");
  if (!ready) return null;

  const rows = docs
    .filter((d) => d.type === type)
    .filter((d) => status === "all" || d.status === status)
    .filter((d) => !q || norm(`${docNumber(d)} ${clientName(clients, d.clientId)}`).includes(norm(q)))
    .sort((a, b) => b.date.localeCompare(a.date) || docNumber(b).localeCompare(docNumber(a)));

  return (
    <div className="stack">
      <div className="row between wrap">
        <h1>{DOC_LABEL[type]}s</h1>
        <NewDocButton type={type} />
      </div>
      <input placeholder="Buscar por número o cliente…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        {(["all", ...STATUSES_BY_TYPE[type], ...(type === "invoice" ? (["cancelled"] as const) : [])] as const).map((s) => (
          <button key={s} className={`chip ${status === s ? "on" : ""}`} onClick={() => setStatus(s)}>
            {s === "all" ? "Todos" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      <div className="card">
        {rows.length === 0 ? (
          <div className="empty">No hay {DOC_LABEL[type].toLowerCase()}s{q || status !== "all" ? " con ese filtro" : " todavía"}.</div>
        ) : (
          <div className="list">
            {rows.map((d) => (
              <Link key={d.id} href={`/documentos/${d.id}`}>
                <div>
                  <strong>{docNumber(d)}</strong>
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
