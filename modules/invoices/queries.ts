import type { SupabaseClient } from "@supabase/supabase-js";
import type { Customer } from "@/modules/clients/types";
import { getWorkshopLogoUrl } from "@/modules/workshops/queries";
import type {
  Invoice,
  InvoiceAdjustment,
  InvoiceLine,
  InvoiceListItem,
  InvoicePdfData,
  InvoiceStats,
  InvoiceStatus,
  InvoiceWithRelations,
} from "./types";

interface DbInvoice {
  id: string;
  workshop_id: string;
  customer_id: string;
  number: number | null;
  status: InvoiceStatus;
  currency: string;
  issued_at: string | null;
  subtotal_cop: number;
  total_adjustments_cop: number;
  total_cop: number;
  payment_method: string | null;
  payment_instructions: string | null;
  notes: string | null;
  voided_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DbInvoiceLine {
  id: string;
  invoice_id: string;
  service_id: string | null;
  description_snapshot: string;
  quantity: number;
  unit_price_cop: number;
  line_total_cop: number;
  created_at: string;
}

interface DbInvoiceAdjustment {
  id: string;
  invoice_id: string;
  label: string;
  category: "tax" | "withholding" | "discount" | "fee";
  mode: "percentage" | "fixed";
  value: number;
  base_cop: number;
  amount_cop: number;
  effect: "add" | "subtract";
  sort_order: number;
  created_at: string;
}

function mapInvoice(row: DbInvoice): Invoice {
  return {
    id: row.id,
    workshopId: row.workshop_id,
    customerId: row.customer_id,
    number: row.number,
    status: row.status,
    currency: row.currency,
    issuedAt: row.issued_at,
    subtotalCop: Number(row.subtotal_cop),
    totalAdjustmentsCop: Number(row.total_adjustments_cop),
    totalCop: Number(row.total_cop),
    paymentMethod: row.payment_method,
    paymentInstructions: row.payment_instructions,
    notes: row.notes,
    voidedAt: row.voided_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInvoiceLine(row: DbInvoiceLine): InvoiceLine {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    serviceId: row.service_id,
    descriptionSnapshot: row.description_snapshot,
    quantity: Number(row.quantity),
    unitPriceCop: Number(row.unit_price_cop),
    lineTotalCop: Number(row.line_total_cop),
    createdAt: row.created_at,
  };
}

function mapInvoiceAdjustment(row: DbInvoiceAdjustment): InvoiceAdjustment {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    label: row.label,
    category: row.category,
    mode: row.mode,
    value: Number(row.value),
    baseCop: Number(row.base_cop),
    amountCop: Number(row.amount_cop),
    effect: row.effect,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

interface DbCustomer {
  id: string;
  workshop_id: string;
  name: string;
  document_type_id: string | null;
  document_number: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  document_types: { name: string }[] | null;
}

function mapCustomer(row: DbCustomer): Customer {
  return {
    id: row.id,
    workshopId: row.workshop_id,
    name: row.name,
    documentTypeId: row.document_type_id,
    documentTypeName: row.document_types?.[0]?.name ?? null,
    documentNumber: row.document_number,
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ListInvoicesOptions {
  status?: InvoiceStatus;
}

export async function listInvoices(
  supabase: SupabaseClient,
  options: ListInvoicesOptions = {},
): Promise<InvoiceListItem[]> {
  let query = supabase
    .from("invoices")
    .select(
      "id, workshop_id, customer_id, number, status, currency, issued_at, subtotal_cop, total_adjustments_cop, total_cop, payment_method, payment_instructions, notes, voided_at, created_at, updated_at, customers(name)",
    )
    .order("created_at", { ascending: false });

  if (options.status) {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const customerName =
      (row.customers as { name: string }[] | null)?.[0]?.name ?? "Sin nombre";
    return {
      ...mapInvoice(row as unknown as DbInvoice),
      customerName,
    };
  });
}

export async function getInvoiceById(
  supabase: SupabaseClient,
  id: string,
): Promise<InvoiceWithRelations | null> {
  const { data: invoiceData, error: invoiceError } = await supabase
    .from("invoices")
    .select(
      "id, workshop_id, customer_id, number, status, currency, issued_at, subtotal_cop, total_adjustments_cop, total_cop, payment_method, payment_instructions, notes, voided_at, created_at, updated_at"
    )
    .eq("id", id)
    .single();

  if (invoiceError || !invoiceData) {
    return null;
  }

  const invoice = mapInvoice(invoiceData as DbInvoice);

  const [{ data: customerData }, { data: linesData }, { data: adjustmentsData }] =
    await Promise.all([
      supabase
        .from("customers")
        .select(
          "id, workshop_id, name, document_type_id, document_number, phone, email, address, notes, is_active, created_at, updated_at, document_types(name)"
        )
        .eq("id", invoice.customerId)
        .single(),
      supabase
        .from("invoice_lines")
        .select(
          "id, invoice_id, service_id, description_snapshot, quantity, unit_price_cop, line_total_cop, created_at"
        )
        .eq("invoice_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("invoice_adjustments")
        .select(
          "id, invoice_id, label, category, mode, value, base_cop, amount_cop, effect, sort_order, created_at"
        )
        .eq("invoice_id", id)
        .order("sort_order", { ascending: true }),
    ]);

  if (!customerData) {
    return null;
  }

  return {
    invoice,
    customer: mapCustomer(customerData as unknown as DbCustomer),
    lines: (linesData ?? []).map((row) =>
      mapInvoiceLine(row as unknown as DbInvoiceLine),
    ),
    adjustments: (adjustmentsData ?? []).map((row) =>
      mapInvoiceAdjustment(row as unknown as DbInvoiceAdjustment),
    ),
  };
}

export async function getInvoiceForPdf(
  supabase: SupabaseClient,
  id: string,
): Promise<InvoicePdfData | null> {
  const { data: invoiceData, error: invoiceError } = await supabase
    .from("invoices")
    .select(
      "id, workshop_id, customer_id, number, status, currency, issued_at, subtotal_cop, total_adjustments_cop, total_cop, payment_method, payment_instructions, notes, voided_at, created_at, updated_at"
    )
    .eq("id", id)
    .single();

  if (invoiceError || !invoiceData) {
    return null;
  }

  const invoice = mapInvoice(invoiceData as DbInvoice);

  const [
    { data: customerData },
    { data: linesData },
    { data: adjustmentsData },
    { data: settingsData },
  ] = await Promise.all([
    supabase
      .from("customers")
      .select(
        "id, workshop_id, name, document_type_id, document_number, phone, email, address, notes, is_active, created_at, updated_at, document_types(name)"
      )
      .eq("id", invoice.customerId)
      .single(),
    supabase
      .from("invoice_lines")
      .select(
        "id, invoice_id, service_id, description_snapshot, quantity, unit_price_cop, line_total_cop, created_at"
      )
      .eq("invoice_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("invoice_adjustments")
      .select(
        "id, invoice_id, label, category, mode, value, base_cop, amount_cop, effect, sort_order, created_at"
      )
      .eq("invoice_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("workshop_settings")
      .select(
        "workshop_id, business_name, tax_id, phone, email, address, invoice_prefix, next_invoice_number, payment_instructions, logo_path, created_at, updated_at"
      )
      .eq("workshop_id", invoice.workshopId)
      .single(),
  ]);

  if (!customerData || !settingsData) {
    return null;
  }

  const settings = settingsData as {
    workshop_id: string;
    business_name: string;
    tax_id: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    invoice_prefix: string;
    next_invoice_number: number;
    payment_instructions: string | null;
    logo_path: string | null;
    created_at: string;
    updated_at: string;
  };

  let logoUrl: string | null = null;
  if (settings.logo_path) {
    logoUrl = await getWorkshopLogoUrl(supabase, settings.logo_path);
  }

  return {
    invoice,
    customer: mapCustomer(customerData as unknown as DbCustomer),
    lines: (linesData ?? []).map((row) =>
      mapInvoiceLine(row as unknown as DbInvoiceLine),
    ),
    adjustments: (adjustmentsData ?? []).map((row) =>
      mapInvoiceAdjustment(row as unknown as DbInvoiceAdjustment),
    ),
    workshopSettings: {
      businessName: settings.business_name,
      taxId: settings.tax_id,
      phone: settings.phone,
      email: settings.email,
      address: settings.address,
      invoicePrefix: settings.invoice_prefix,
    },
    logoUrl,
  };
}

export async function getInvoiceStats(
  supabase: SupabaseClient,
): Promise<InvoiceStats> {
  const [{ data: invoicesData }, { data: issuedData }] = await Promise.all([
    supabase
      .from("invoices")
      .select("status")
      .in("status", ["draft", "issued", "void"]),
    supabase
      .from("invoices")
      .select("total_cop")
      .eq("status", "issued"),
  ]);

  const countByStatus: Record<InvoiceStatus, number> = {
    draft: 0,
    issued: 0,
    void: 0,
  };

  (invoicesData ?? []).forEach((row) => {
    const status = row.status as InvoiceStatus;
    if (status in countByStatus) {
      countByStatus[status] += 1;
    }
  });

  const totalInvoicedCop = (issuedData ?? []).reduce(
    (sum, row) => sum + Number(row.total_cop),
    0,
  );

  return {
    totalInvoicedCop,
    countByStatus,
    recentInvoices: [],
  };
}
