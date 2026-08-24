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

export async function getCustomerByIdAsAdmin(
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

export async function listCustomersByWorkshop(
  supabase: SupabaseClient,
  workshopId: string,
): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, workshop_id, name, document_type_id, document_number, phone, email, address, notes, is_active, created_at, updated_at, document_types(name)",
    )
    .eq("workshop_id", workshopId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row: DbCustomer) => mapCustomer(row));
}
