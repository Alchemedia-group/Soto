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

export type CatalogItem = {
  id: string;
  name: string;
  price: number; // unit price, IVA excluded
  vat: number; // percent
  unit: string; // "ud", "h", "m"...
  category: string; // Fontanería, Clima, Electricidad, Fotovoltaica or ""
  uses: number; // how often it has been added to a document (for ranking suggestions)
  createdAt: string;
};

export const CATEGORIES = ["Fontanería", "Clima", "Electricidad", "Fotovoltaica"];

export type DocType = "quote" | "invoice";
export type DocStatus = "draft" | "sent" | "accepted" | "rejected" | "paid" | "cancelled";

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
  /** Set when an invoice is cancelled. If `released`, `number` is "" and the old number is free for the next invoice. */
  cancelled?: { at: string; formerNumber: string; released: boolean };
  createdAt: string;
};

export type Settings = {
  companyName: string;
  nif: string;
  address: string;
  phone: string;
  email: string;
  iban: string;
  bizum: string; // phone number that receives Bizum payments
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
  bizum: "",
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
  cancelled: "Anulada",
};

export const STATUSES_BY_TYPE: Record<DocType, DocStatus[]> = {
  quote: ["draft", "sent", "accepted", "rejected"],
  invoice: ["draft", "sent", "paid"],
};

export const DOC_LABEL: Record<DocType, string> = {
  quote: "Presupuesto",
  invoice: "Factura",
};
