import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "Soto Instalaciones Integrales",
  description: "Clientes, presupuestos y facturas de Soto Instalaciones Integrales.",
  appleWebApp: { capable: true, title: "Soto", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#0f766e", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
