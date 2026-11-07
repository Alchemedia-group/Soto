"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { addClient, useStore } from "@/lib/store";
import { norm } from "@/lib/format";
import { Icon } from "@/components/Icon";

export default function Clientes() {
  const { ready, clients, docs } = useStore();
  const router = useRouter();
  const [q, setQ] = useState("");
  if (!ready) return null;
  const rows = clients
    .filter((c) => !q || norm(`${c.name} ${c.phone} ${c.email} ${c.nif}`).includes(norm(q)))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  return (
    <div className="stack">
      <div className="row between wrap">
        <h1>Clientes</h1>
        <button className="btn primary" onClick={() => router.push(`/clientes/${addClient({ name: "Nuevo cliente" }).id}`)}>
          <Icon name="plus" size={18} /> Nuevo cliente
        </button>
      </div>
      <input placeholder="Buscar cliente…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="card">
        {rows.length === 0 ? (
          <div className="empty">{clients.length ? "Sin resultados." : "Todavía no hay clientes."}</div>
        ) : (
          <div className="list">
            {rows.map((c) => (
              <Link key={c.id} href={`/clientes/${c.id}`}>
                <div>
                  <strong>{c.name}</strong>
                  <div className="muted" style={{ fontSize: ".85rem" }}>{[c.phone, c.email].filter(Boolean).join(" · ") || "Sin contacto"}</div>
                </div>
                <span className="muted">{docs.filter((d) => d.clientId === c.id).length} docs</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
