"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { Voice } from "./Voice";
import { useStore } from "@/lib/store";
import { startSync, useSync } from "@/lib/sync";
import { LoginScreen } from "./AuthGate";
import { initTheme } from "@/lib/theme";

const NAV = [
  { href: "/", label: "Inicio", icon: "home", phone: true },
  { href: "/clientes", label: "Clientes", icon: "users", phone: true },
  { href: "/presupuestos", label: "Presupuestos", short: "Presup.", icon: "quote", phone: true },
  { href: "/facturas", label: "Facturas", icon: "invoice", phone: true },
  { href: "/catalogo", label: "Catálogo", icon: "tag", phone: true },
  { href: "/ajustes", label: "Ajustes", icon: "cog", phone: true },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { settings } = useStore();
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  // Phone tab bar: hide while scrolling down, show again on scroll up / near the top.
  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastY.current;
      if (y < 40 || dy < -6) setHidden(false);
      else if (dy > 6) setHidden(true);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setHidden(false), [path]);

  const on = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const mk = (items: typeof NAV, phone = false) =>
    items.map((n) => (
      <Link key={n.href} href={n.href} className={on(n.href) ? "on" : ""}>
        <Icon name={n.icon} size={20} />
        {phone ? (
          <>
            <span className="lbl-full">{n.label}</span>
            <span className="lbl-short">{"short" in n ? n.short : n.label}</span>
          </>
        ) : (
          <span>{n.label}</span>
        )}
      </Link>
    ));
  const sync = useSync();
  useEffect(() => { startSync(); initTheme(); }, []);
  if (sync.enabled && !sync.ready) return null; // checking session
  if (sync.enabled && !sync.signedIn) return <LoginScreen />;
  const syncLabel =
    sync.status === "offline" ? "Sin conexión · se subirá al volver"
    : sync.status === "error" ? "Error de sincronización"
    : sync.status === "syncing" || sync.pending ? "Sincronizando…"
    : sync.enabled ? "Sincronizado" : "Solo en este dispositivo";
  return (
    <div className={`shell ${hidden ? "nav-hidden" : ""}`}>
      <aside className="side">
        <div className="brand">
          {settings.companyName}
          <small>Gestión</small>
        </div>
        <nav className="nav">{mk(NAV)}</nav>
        <div className="muted" style={{ fontSize: ".75rem", padding: "1rem .7rem 0" }}>{syncLabel}</div>
      </aside>
      <main className="main">{children}</main>
      <nav className="tabbar">{mk(NAV.filter((n) => n.phone), true)}</nav>
      <Voice />
    </div>
  );
}
