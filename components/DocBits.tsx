"use client";
import { useRouter } from "next/navigation";
import { createDoc } from "@/lib/store";
import { DOC_LABEL, STATUS_LABEL, type Doc, type DocType } from "@/lib/types";
import { today } from "@/lib/format";
import { Icon } from "./Icon";

export function isOverdue(d: Doc) {
  return d.type === "invoice" && d.status === "sent" && !!d.dueDate && d.dueDate < today();
}

export function StatusBadge({ doc }: { doc: Doc }) {
  if (isOverdue(doc)) return <span className="badge overdue">Vencida</span>;
  return <span className={`badge ${doc.status}`}>{STATUS_LABEL[doc.status]}</span>;
}

export function NewDocButton({ type, clientId, primary = true }: { type: DocType; clientId?: string; primary?: boolean }) {
  const router = useRouter();
  return (
    <button
      className={`btn ${primary ? "primary" : ""}`}
      onClick={() => router.push(`/documentos/${createDoc(type, { clientId }).id}`)}
    >
      <Icon name="plus" size={18} /> {type === "quote" ? "Nuevo presupuesto" : "Nueva factura"}
    </button>
  );
}
