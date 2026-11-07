"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { Voice } from "./Voice";
import { useStore } from "@/lib/store";

const NAV = [
  { href: "/", label: "Inicio", icon: "home" },
  { href: "/clientes", label: "Clientes", icon: "users" },
  { href: "/presupuestos", label: "Presupuestos", icon: "quote" },
  { href: "/facturas", label: "Facturas", icon: "invoice" },
  { href: "/ajustes", label: "Ajustes", icon: "cog" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { settings } = useStore();
  const on = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const links = NAV.map((n) => (
    <Link key={n.href} href={n.href} className={on(n.href) ? "on" : ""}>
      <Icon name={n.icon} size={20} />
      <span>{n.label}</span>
    </Link>
  ));
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          {settings.companyName}
          <small>Gestión</small>
        </div>
        <nav className="nav">{links}</nav>
      </aside>
      <main className="main">{children}</main>
      <nav className="tabbar">{links}</nav>
      <Voice />
    </div>
  );
}
