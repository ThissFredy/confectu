import type { Customer } from "@/modules/clients/types";

export type InvoiceStatus = "draft" | "issued" | "void";
export type AdjustmentCategory = "tax" | "withholding" | "discount" | "fee";
export type AdjustmentMode = "percentage" | "fixed";
export type AdjustmentEffect = "add" | "subtract";

export interface Invoice {
  id: string;
  workshopId: string;
  customerId: string;
  number: number | null;
  status: InvoiceStatus;
  currency: string;
  issuedAt: string | null;
  subtotalCop: number;
  totalAdjustmentsCop: number;
  totalCop: number;
  paymentMethod: string | null;
  paymentInstructions: string | null;
  notes: string | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  serviceId: string | null;
  descriptionSnapshot: string;
  quantity: number;
  unitPriceCop: number;
  lineTotalCop: number;
  createdAt: string;
}

export interface InvoiceAdjustment {
  id: string;
  invoiceId: string;
  label: string;
  category: AdjustmentCategory;
  mode: AdjustmentMode;
  value: number;
  baseCop: number;
  amountCop: number;
  effect: AdjustmentEffect;
  sortOrder: number;
  createdAt: string;
}

export interface InvoiceWithRelations {
  invoice: Invoice;
  customer: Customer;
  lines: InvoiceLine[];
  adjustments: InvoiceAdjustment[];
}

export interface InvoiceLineInput {
  serviceId: string | null;
  description: string;
  quantity: number;
  unitPriceCop: number;
}

export interface InvoiceAdjustmentInput {
  label: string;
  category: AdjustmentCategory;
  mode: AdjustmentMode;
  value: number;
}

export interface InvoiceInput {
  customerId: string;
  lines: InvoiceLineInput[];
  adjustments: InvoiceAdjustmentInput[];
  paymentMethod: string | null;
  paymentInstructions: string | null;
  notes: string | null;
}

export interface InvoiceActionResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  invoiceId?: string;
}

export interface CustomerFromInvoiceResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  customerId?: string;
}

export interface InvoiceTotals {
  subtotalCop: number;
  totalAdjustmentsCop: number;
  totalCop: number;
  adjustments: Array<{
    id: string;
    baseCop: number;
    amountCop: number;
    effect: AdjustmentEffect;
  }>;
}

export interface InvoicePdfData {
  invoice: Invoice;
  customer: Customer;
  lines: InvoiceLine[];
  adjustments: InvoiceAdjustment[];
  workshopSettings: {
    businessName: string;
    taxId: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    invoicePrefix: string;
  };
  logoUrl: string | null;
}

export interface InvoiceListItem extends Invoice {
  customerName: string;
}

export interface InvoiceStats {
  totalInvoicedCop: number;
  countByStatus: Record<InvoiceStatus, number>;
  recentInvoices: Invoice[];
}
