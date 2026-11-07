"use client";
import { useState } from "react";
import { signIn, signUp } from "@/lib/sync";

export function LoginScreen() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    if (mode === "in") {
      setMsg(await signIn(email.trim(), password));
    } else {
      const r = await signUp(email.trim(), password);
      setMsg(r.error || (r.needsConfirm ? "Cuenta creada. Revisa tu correo, confirma el enlace y vuelve aquí para entrar." : ""));
    }
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "1rem" }}>
      <form className="card stack" style={{ width: "min(420px, 100%)" }} onSubmit={submit}>
        <div className="doc-logo" style={{ margin: "0 auto" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="Soto Instalaciones Integrales" />
        </div>
        <div>
          <h1>{mode === "in" ? "Entrar" : "Crear cuenta"}</h1>
          <p className="muted" style={{ margin: 0 }}>
            Con la misma cuenta verás los mismos datos en el móvil y en el ordenador.
          </p>
        </div>
        <div><label htmlFor="em">Email</label><input id="em" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><label htmlFor="pw">Contraseña</label><input id="pw" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {msg && <div role="alert" style={{ color: msg.startsWith("Cuenta creada") ? "var(--ok)" : "var(--danger)" }}>{msg}</div>}
        <button className="btn primary" disabled={busy}>{busy ? "…" : mode === "in" ? "Entrar" : "Crear cuenta"}</button>
        <button type="button" className="btn" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(""); }}>
          {mode === "in" ? "Primera vez: crear cuenta" : "Ya tengo cuenta"}
        </button>
      </form>
    </div>
  );
}
