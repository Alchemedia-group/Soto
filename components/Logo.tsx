/* eslint-disable @next/next/no-img-element */
/** Brand logo with a transparent background: navy on light themes, light on dark ones (follows the theme setting too). */
export function Logo({ width = 220, alt = "Soto Instalaciones Integrales", style }: { width?: number; alt?: string; style?: React.CSSProperties }) {
  const base: React.CSSProperties = { width, height: "auto", maxWidth: "100%", ...style };
  return (
    <>
      <img className="logo-for-light" src="/logo-navy.png" alt={alt} style={base} />
      <img className="logo-for-dark" src="/logo-light.png" alt="" aria-hidden="true" style={base} />
    </>
  );
}
