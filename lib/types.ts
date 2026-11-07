export type Client = {
  id: string;
  name: string;
  nif: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  createdAt: string;
};

export type Line = {
  id: string;
  description: string;
  qty: number;
  price: number; // unit price, IVA excluded
  vat: number; // percent
};

export type DocType = "quote" | "invoice";
export type DocStatus = "draft" | "sent" | "accepted" | "rejected" | "paid";

export type Doc = {
  id: string;
  type: DocType;
  number: string;
  clientId: string;
  date: string; // yyyy-mm-dd
  dueDate: string; // invoices only, may be ""
  lines: Line[];
  irpf: number; // retention percent
  status: DocStatus;
  notes: string;
  fromQuoteId?: string;
  lastReminder?: string; // yyyy-mm-dd of the last payment reminder sent
  createdAt: string;
};

export type Settings = {
  companyName: string;
  nif: string;
  address: string;
  phone: string;
  email: string;
  iban: string;
  defaultVat: number;
  defaultIrpf: number;
  quotePrefix: string;
  invoicePrefix: string;
  paymentDays: number;
  footer: string;
};

export const DEFAULT_SETTINGS: Settings = {
  companyName: "Soto Instalaciones Integrales",
  nif: "",
  address: "",
  phone: "",
  email: "",
  iban: "",
  defaultVat: 21,
  defaultIrpf: 0,
  quotePrefix: "P",
  invoicePrefix: "F",
  paymentDays: 30,
  footer: "",
};

export const STATUS_LABEL: Record<DocStatus, string> = {
  draft: "Borrador",
  sent: "Enviado",
  accepted: "Aceptado",
  rejected: "Rechazado",
  paid: "Cobrada",
};

export const STATUSES_BY_TYPE: Record<DocType, DocStatus[]> = {
  quote: ["draft", "sent", "accepted", "rejected"],
  invoice: ["draft", "sent", "paid"],
};

export const DOC_LABEL: Record<DocType, string> = {
  quote: "Presupuesto",
  invoice: "Factura",
};
