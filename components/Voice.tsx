"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { getState, useStore } from "@/lib/store";
import { buildContext, localFallback, runAction, type Action } from "@/lib/actions";


type Msg = { who: "me" | "bot"; text: string };

// Minimal typing for the (webkit-prefixed) Web Speech API.
type SR = {
  lang: string; interimResults: boolean; continuous: boolean;
  start(): void; stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
};

export function Voice() {
  const router = useRouter();
  const st = useStore();
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [hasSR, setHasSR] = useState(true);
  const recRef = useRef<SR | null>(null);
  const heard = useRef("");

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    setHasSR(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const say = (t: string) => {
    setMsgs((m) => [...m, { who: "bot", text: t }]);
    try {
      if ("speechSynthesis" in window && t) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(t);
        u.lang = "es-ES";
        window.speechSynthesis.speak(u);
      }
    } catch {}
  };

  async function send(input: string) {
    const q = input.trim();
    if (!q) return;
    setMsgs((m) => [...m, { who: "me", text: q }]);
    setText("");
    setBusy(true);
    let reply = "";
    let actions: Action[] = [];
    try {
      const r = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: q, context: buildContext(getState()) }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      if (j.offline) {
        actions = localFallback(q);
        reply = actions.length ? "" : "Para entender órdenes complejas hay que configurar la clave de Claude (ANTHROPIC_API_KEY).";
      } else {
        reply = j.reply;
        actions = j.actions;
      }
    } catch {
      actions = localFallback(q);
      reply = actions.length ? "" : "No he podido conectar con el asistente.";
    }
    const results = actions.map((a) => runAction(a, getState)).filter((r) => r.message);
    const last = [...results].reverse().find((r) => r.path);
    const spoken = reply || results.map((r) => r.message).join(" ") || "Hecho.";
    // If the model answered AND acted, say its sentence but still surface failed actions.
    const problems = reply ? results.filter((r) => /^(No |Falta)/.test(r.message)).map((r) => r.message) : [];
    say([spoken, ...problems].join(" "));
    setBusy(false);
    if (last?.path) {
      router.push(last.path);
      // Let the reply be read/heard, then get out of the way of the page we just opened.
      setTimeout(() => setOpen(false), 4000);
    }
  }

  function toggleMic() {
    if (listening) { recRef.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) { setOpen(true); return; }
    const rec = new Ctor();
    rec.lang = "es-ES";
    rec.interimResults = true;
    rec.continuous = false;
    heard.current = "";
    rec.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      heard.current = t;
      setText(t);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      if (heard.current.trim()) send(heard.current);
    };
    recRef.current = rec;
    setOpen(true);
    setListening(true);
    try { window.speechSynthesis?.cancel(); rec.start(); } catch { setListening(false); }
  }

  void st; // subscribe so the panel re-renders with fresh data
  return (
    <>
      {open && (
        <div className="panel">
          <div className="row between">
            <strong>Asistente</strong>
            <button className="btn sm" onClick={() => { setOpen(false); recRef.current?.stop(); window.speechSynthesis?.cancel(); }}>Cerrar</button>
          </div>
          <div style={{ maxHeight: "34dvh", overflowY: "auto", margin: ".5rem 0" }}>
            {msgs.length === 0 && (
              <p className="muted" style={{ margin: 0 }}>
                Prueba: “Haz un presupuesto para Casa García: cambiar caldera, mil doscientos euros” · “¿Cuánto me deben?” · “Marca la factura 3 como cobrada”.
              </p>
            )}
            {msgs.map((m, i) => (<div key={i} className={`bubble ${m.who}`}>{m.text}</div>))}
            {busy && <div className="bubble muted">Pensando…</div>}
          </div>
          {!hasSR && <p className="muted" style={{ fontSize: ".8rem" }}>Tu navegador no admite dictado por voz; escribe la orden.</p>}
          <form className="row" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={listening ? "Escuchando…" : "Escribe o pulsa el micrófono"} />
            <button className="btn primary" disabled={busy || !text.trim()}>Enviar</button>
          </form>
        </div>
      )}
      <button className={`mic ${listening ? "live" : ""}`} onClick={toggleMic} aria-label={listening ? "Parar" : "Hablar con el asistente"}>
        <Icon name="mic" size={28} />
      </button>
    </>
  );
}
