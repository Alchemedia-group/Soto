import type { Metadata } from "next";

// The client's page: never indexed, and the secret link is not leaked to other sites through the referrer.
export const metadata: Metadata = {
  title: "Presupuesto",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
