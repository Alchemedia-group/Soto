"use client";
import { useEffect, useState } from "react";
import { canShare, downloadFile, pdfFile, shareFile } from "@/lib/pdf-client";
import type { Client, Doc, Settings } from "@/lib/types";

/** "Descargar PDF" (a real .pdf file) plus "Compartir" where the device has a share sheet (phones). */
export function PdfButtons({ doc, client, settings, text }: { doc: Doc; client?: Client; settings: Settings; text: string }) {
  const [busy, setBusy] = useState<"" | "dl" | "share">("");
  const [msg, setMsg] = useState("");
  const [share, setShare] = useState(false);
  useEffect(() => setShare(canShare()), []);

  async function run(kind: "dl" | "share") {
    setBusy(kind);
    setMsg("");
    try {
      const f = await pdfFile(doc, client, settings);
      if (kind === "share") {
        if (!(await shareFile(f, text))) {
          downloadFile(f);
          setMsg("Este dispositivo no puede compartir archivos desde aquí: se ha descargado el PDF.");
        }
      } else downloadFile(f);
    } catch {
      setMsg("No se pudo crear el PDF. Inténtalo de nuevo.");
    }
    setBusy("");
  }

  return (
    <>
      <button className="btn" disabled={!!busy} onClick={() => run("dl")}>{busy === "dl" ? "Creando PDF…" : "Descargar PDF"}</button>
      {share && <button className="btn" disabled={!!busy} onClick={() => run("share")}>{busy === "share" ? "Creando PDF…" : "Compartir PDF"}</button>}
      {msg && <div role="status" className="muted" style={{ fontSize: ".85rem", flexBasis: "100%" }}>{msg}</div>}
    </>
  );
}
