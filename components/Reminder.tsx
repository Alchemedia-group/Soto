"use client";
import { updateDoc } from "@/lib/store";
import { today } from "@/lib/format";
import { reminderMailto, reminderWhatsApp } from "@/lib/reminder";
import type { Client, Doc, Settings } from "@/lib/types";

/** Email + WhatsApp payment-reminder buttons. Opens the user's own mail/WhatsApp app and logs the date. */
export function ReminderButtons({ doc, client, settings, small = false }: { doc: Doc; client?: Client; settings: Settings; small?: boolean }) {
  const mark = () => updateDoc(doc.id, { lastReminder: today() });
  const cls = `btn${small ? " sm" : ""}`;
  return (
    <>
      {client?.email ? (
        <a className={cls} href={reminderMailto(doc, client, settings)} onClick={mark}>Recordatorio por email</a>
      ) : (
        <button className={cls} onClick={() => alert("Este cliente no tiene email. Añádelo en su ficha para enviarle el recordatorio.")}>Recordatorio por email</button>
      )}
      <a className={cls} href={reminderWhatsApp(doc, client, settings)} target="_blank" rel="noreferrer" onClick={mark}>WhatsApp</a>
    </>
  );
}
