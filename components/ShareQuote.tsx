"use client";
import { useState } from "react";
import { updateDoc } from "@/lib/store";
import { newToken, quoteLink } from "@/lib/share";
import { useSync } from "@/lib/sync";
import { fmtDate, money, phoneForWhatsApp, totals } from "@/lib/format";
import type { Client, Doc, Settings } from "@/lib/types";

/** Owner's side of "accept by link": create / copy / send / switch off the link, and see the client's answer. */
export function ShareQuote({ doc, client, settings }: { doc: Doc; client?: Client; settings: Settings }) {
  const sync = useSync();
  const [copied, setCopied] = useState("");
  const link = doc.shareToken ? quoteLink(doc.shareToken) : "";
  const live = sync.pending === 0 && sync.status === "idle"; // the link only works once the quote is in the shared database
  const msg = `Hola${client ? " " + client.name : ""}, te envío el presupuesto ${doc.number} de ${settings.companyName} por importe de ${money(totals(doc).total)}. Puedes revisarlo y aceptarlo aquí: ${link}`;
  const r = doc.response;

  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied("Enlace copiado"); } catch { setCopied("Selecciona el enlace y cópialo"); }
    setTimeout(() => setCopied(""), 2500);
  }

  if (!sync.enabled || !sync.signedIn)
    return (
      <div className="card muted">
        El enlace para que el cliente acepte el presupuesto necesita la cuenta compartida (inicia sesión). Mientras tanto, márcalo como aceptado a mano.
      </div>
    );

  return (
    <div className="card stack">
      <div>
        <strong>Que el cliente lo acepte desde su móvil</strong>
        <div className="muted">Le envías un enlace, él lo abre sin instalar nada ni crear cuenta y pulsa Aceptar o Rechazar. El presupuesto se actualiza solo.</div>
      </div>

      {r && (
        <div className="note" role="status" style={{ borderLeft: `4px solid ${r.decision === "accepted" ? "var(--ok)" : "var(--danger)"}` }}>
          <strong>{r.decision === "accepted" ? "Aceptado" : "Rechazado"}{r.name ? ` por ${r.name}` : ""}</strong> el {fmtDate(r.at.slice(0, 10))} a las {new Date(r.at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
          {r.comment && <div style={{ marginTop: 4 }}>“{r.comment}”</div>}
        </div>
      )}

      {!link ? (
        <div>
          <button className="btn primary" onClick={() => updateDoc(doc.id, { shareToken: newToken(), status: doc.status === "draft" ? "sent" : doc.status })}>Crear enlace de aceptación</button>
          {doc.status === "draft" && <div className="muted" style={{ fontSize: ".85rem", marginTop: 6 }}>Al crearlo, el presupuesto pasa a “Enviado”.</div>}
        </div>
      ) : (
        <>
          <div><label htmlFor="lnk">Enlace para el cliente</label><input id="lnk" readOnly value={link} onFocus={(e) => e.currentTarget.select()} /></div>
          {!live && <div className="muted" style={{ fontSize: ".85rem" }}>Sincronizando… el enlace funcionará en unos segundos.</div>}
          {link.startsWith("http://localhost") && <div className="muted" style={{ fontSize: ".85rem" }}>Este enlace solo funciona en este ordenador: la app todavía no está publicada en internet.</div>}
          <div className="row wrap">
            <button className="btn" disabled={!live} onClick={copy}>Copiar enlace</button>
            <a className="btn" aria-disabled={!live} href={`https://wa.me/${phoneForWhatsApp(client?.phone ?? "")}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer">Enviar por WhatsApp</a>
            <a className="btn" href={`mailto:${client?.email ?? ""}?subject=${encodeURIComponent(`Presupuesto ${doc.number} – ${settings.companyName}`)}&body=${encodeURIComponent(msg.replace(/\n/g, "\r\n"))}`}>Enviar por email</a>
            <button className="btn danger" onClick={() => { if (confirm("¿Desactivar el enlace? Dejará de funcionar para el cliente.")) updateDoc(doc.id, { shareToken: undefined }); }}>Desactivar enlace</button>
          </div>
          {copied && <div role="status" className="muted">{copied}</div>}
        </>
      )}
    </div>
  );
}
