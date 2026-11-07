"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase, syncEnabled } from "@/lib/supabase";
import { addDays, fmtDate, money, totals } from "@/lib/format";
import type { Line } from "@/lib/types";
import { Logo } from "@/components/Logo";

type Quote = {
  number: string; date: string; status: string; lines: Omit<Line, "id">[]; irpf: number; notes: string; client_name: string | null;
  response: null | { decision: "accepted" | "rejected"; name: string; comment: string; at: string };
  company: { name?: string; nif?: string; address?: string; phone?: string; email?: string };
};

/** Public page (no login): the client reads the quote and accepts or rejects it. */
export default function Aceptar() {
  const { token } = useParams<{ token: string }>();
  const [q, setQ] = useState<Quote | null | undefined>(undefined); // undefined = loading, null = invalid link
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    if (!supabase) return setQ(null);
    const { data, error } = await supabase.rpc("get_quote_for_client", { p_token: token });
    setQ(error ? null : (data as Quote | null));
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  async function answer(decision: "accepted" | "rejected") {
    if (decision === "accepted" && !name.trim()) { setMsg("Escribe tu nombre para aceptar el presupuesto."); return; }
    setBusy(true); setMsg("");
    const { data, error } = await supabase!.rpc("respond_to_quote", { p_token: token, p_decision: decision, p_name: name, p_comment: comment });
    setBusy(false);
    if (error || !data) { setMsg("No hemos podido enviar tu respuesta. Inténtalo de nuevo."); return; }
    if (!data.ok && data.error === "already") setMsg("Este presupuesto ya tenía una respuesta.");
    await load();
  }

  const wrap = (c: React.ReactNode) => <div style={{ maxWidth: 760, margin: "0 auto", padding: "1rem 1rem 3rem" }} className="stack">{c}</div>;
  if (!syncEnabled) return wrap(<div className="card empty">Esta página no está disponible.</div>);
  if (q === undefined) return wrap(<div className="empty">Cargando…</div>);
  if (q === null) return wrap(<div className="card empty"><strong>Este enlace no es válido o ya no está activo.</strong><div>Pide a la empresa que te envíe uno nuevo.</div></div>);

  const t = totals({ lines: q.lines.map((l, i) => ({ ...l, id: String(i) })), irpf: q.irpf });
  const co = q.company ?? {};
  const answered = q.status === "accepted" || q.status === "rejected";
  const accepted = q.status === "accepted";

  return wrap(
    <>
      <div className="row between wrap" style={{ alignItems: "flex-start" }}>
        <Logo width={200} alt={co.name ?? "Soto"} />
        <div className="right muted" style={{ fontSize: ".85rem" }}>
          <strong style={{ color: "var(--text)" }}>{co.name}</strong>
          {[co.nif && `NIF ${co.nif}`, ...(co.address ?? "").split("\n"), co.phone, co.email].filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </div>

      <div>
        <h1>Presupuesto {q.number}</h1>
        <div className="muted">{q.client_name ? `Para ${q.client_name} · ` : ""}{fmtDate(q.date)} · válido hasta {fmtDate(addDays(q.date, 30))}</div>
      </div>

      <div className="card">
        <h2>Conceptos</h2>
        <div className="list">
          {q.lines.filter((l) => l.description || l.price).map((l, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: ".7rem 0" }}>
              <div style={{ minWidth: 0 }}>
                <div>{l.description}</div>
                <div className="muted" style={{ fontSize: ".85rem" }}>{String(l.qty).replace(".", ",")} × {money(l.price)} · IVA {l.vat}%</div>
              </div>
              <strong style={{ whiteSpace: "nowrap" }}>{money(l.qty * l.price)}</strong>
            </div>
          ))}
        </div>
        <div className="totals" style={{ marginTop: ".5rem" }}>
          <div><span className="muted">Base imponible</span><span>{money(t.base)}</span></div>
          {t.byRate.map((r) => <div key={r.rate}><span className="muted">IVA {r.rate}%</span><span>{money(r.vat)}</span></div>)}
          {q.irpf > 0 && <div><span className="muted">Retención IRPF {q.irpf}%</span><span>−{money(t.irpf)}</span></div>}
          <div className="big"><span>Total</span><span>{money(t.total)}</span></div>
        </div>
      </div>
      {q.notes && <div className="card" style={{ whiteSpace: "pre-line" }}>{q.notes}</div>}

      {answered ? (
        <div className="card" style={{ borderColor: accepted ? "var(--ok)" : "var(--danger)" }} role="status">
          <h2>{accepted ? "Presupuesto aceptado" : "Presupuesto rechazado"}</h2>
          <div>{q.response ? `${q.response.name ? q.response.name + " · " : ""}${new Date(q.response.at).toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" })}` : ""}</div>
          <div className="muted">{accepted ? `Gracias. ${co.name ?? "La empresa"} ya ha recibido tu respuesta y se pondrá en contacto contigo.` : `${co.name ?? "La empresa"} ya ha recibido tu respuesta.`}</div>
        </div>
      ) : (
        <div className="card stack">
          <h2>¿Qué decides?</h2>
          <div><label htmlFor="nm">Tu nombre</label><input id="nm" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label htmlFor="cm">Comentario (opcional)</label><textarea id="cm" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Por ejemplo, cuándo te viene bien la instalación" /></div>
          <div className="muted" style={{ fontSize: ".85rem" }}>Al aceptar confirmas que estás de acuerdo con este presupuesto y sus condiciones. Se guardará tu nombre y la fecha y hora de tu respuesta.</div>
          {msg && <div role="alert" style={{ color: "var(--danger)" }}>{msg}</div>}
          <div className="row wrap">
            <button className="btn primary" disabled={busy} onClick={() => answer("accepted")}>Aceptar presupuesto</button>
            <button className="btn" disabled={busy} onClick={() => answer("rejected")}>Rechazar</button>
          </div>
        </div>
      )}
      {answered && msg && <div className="muted">{msg}</div>}
    </>,
  );
}
