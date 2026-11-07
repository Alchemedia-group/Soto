"use client";
import { makePdf, pdfFilename } from "./pdf";
import type { Client, Doc, Settings } from "./types";

async function loadLogo(): Promise<string | undefined> {
  try {
    const blob = await (await fetch("/logo-crop.jpg")).blob();
    return await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(blob);
    });
  } catch {
    return undefined; // the PDF falls back to a text wordmark
  }
}

/** Builds the PDF as a File, ready to download or share. */
export async function pdfFile(d: Doc, client: Client | undefined, s: Settings, acceptUrl?: string): Promise<File> {
  const doc = await makePdf(d, client, s, await loadLogo(), acceptUrl);
  return new File([doc.output("blob")], pdfFilename(d, client), { type: "application/pdf" });
}

export function downloadFile(f: File) {
  const url = URL.createObjectURL(f);
  const a = document.createElement("a");
  a.href = url;
  a.download = f.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const canShare = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

/** Opens the phone's share sheet with the PDF attached (WhatsApp, Gmail…). Returns false if files can't be shared here. */
export async function shareFile(f: File, text: string): Promise<boolean> {
  if (!canShare() || !navigator.canShare?.({ files: [f] })) return false;
  try {
    await navigator.share({ files: [f], title: f.name, text });
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return true; // user closed the share sheet
    throw e;
  }
}
