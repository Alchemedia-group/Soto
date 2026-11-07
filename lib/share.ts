/** Random secret for a quote's public link (48 hex chars = 192 bits: not guessable). */
export function newToken() {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Public URL where the client answers. Set NEXT_PUBLIC_APP_URL to the app's real address once it is hosted. */
export function quoteLink(token: string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/$/, "");
  return `${base}/aceptar/${token}`;
}
