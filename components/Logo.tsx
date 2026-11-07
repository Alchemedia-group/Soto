/* eslint-disable @next/next/no-img-element */
/** Brand logo with a transparent background: navy on light themes, light on dark ones (follows the theme setting too). */
export function Logo({
  width = 220,
  alt = "Soto Instalaciones Integrales",
  variant = "full",
  style,
}: {
  width?: number;
  alt?: string;
  /** "full": icons + SOTO + subtitle. "wordmark": just the letters S-O-T-O. */
  variant?: "full" | "wordmark";
  style?: React.CSSProperties;
}) {
  const base: React.CSSProperties = { width, height: "auto", maxWidth: "100%", ...style };
  const files = variant === "wordmark" ? ["/logo-soto-navy.png", "/logo-soto-light.png"] : ["/logo-navy.png", "/logo-light.png"];
  return (
    <>
      <img className="logo-for-light" src={files[0]} alt={alt} style={base} />
      <img className="logo-for-dark" src={files[1]} alt="" aria-hidden="true" style={base} />
    </>
  );
}
