import type { SupabaseClient } from "@supabase/supabase-js";
import type { Customer } from "./types";

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

export interface ListCustomersOptions {
  includeInactive?: boolean;
}

export async function listCustomers(
  supabase: SupabaseClient,
  options: ListCustomersOptions = {},
): Promise<Customer[]> {
  const { includeInactive = false } = options;

  let query = supabase
    .from("customers")
    .select(
      "id, workshop_id, name, document_type_id, document_number, phone, email, address, notes, is_active, created_at, updated_at, document_types(name)",
    )
    .order("name", { ascending: true });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row: DbCustomer) => mapCustomer(row));
}

export async function getCustomerById(
  supabase: SupabaseClient,
  id: string,
): Promise<Customer | null> {
  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, workshop_id, name, document_type_id, document_number, phone, email, address, notes, is_active, created_at, updated_at, document_types(name)",
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return mapCustomer(data as DbCustomer);
}

export async function searchCustomersForInvoice(
  supabase: SupabaseClient,
  query: string,
): Promise<Customer[]> {
  const normalizedQuery = query.trim().toLowerCase();

  let dbQuery = supabase
    .from("customers")
    .select(
      "id, workshop_id, name, document_type_id, document_number, phone, email, address, notes, is_active, created_at, updated_at, document_types(name)",
    )
    .eq("is_active", true);

  if (normalizedQuery.length > 0) {
    dbQuery = dbQuery.or(
      `name.ilike.%${normalizedQuery}%,document_number.ilike.%${normalizedQuery}%`,
    );
  }

  const { data, error } = await dbQuery
    .order("name", { ascending: true })
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row: DbCustomer) => mapCustomer(row));
}
