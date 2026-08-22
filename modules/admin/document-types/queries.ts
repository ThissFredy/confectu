import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminCounts, DocumentType } from "./types";

interface DbDocumentType {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function mapDocumentType(row: DbDocumentType): DocumentType {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listDocumentTypes(
  supabase: SupabaseClient,
): Promise<DocumentType[]> {
  const { data, error } = await supabase
    .from("document_types")
    .select("id, code, name, is_active, created_at, updated_at")
    .order("code", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row: DbDocumentType) => mapDocumentType(row));
}

export async function getDocumentTypeById(
  supabase: SupabaseClient,
  id: string,
): Promise<DocumentType | null> {
  const { data, error } = await supabase
    .from("document_types")
    .select("id, code, name, is_active, created_at, updated_at")
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return mapDocumentType(data as DbDocumentType);
}

export async function getActiveDocumentTypes(
  supabase: SupabaseClient,
): Promise<DocumentType[]> {
  const { data, error } = await supabase
    .from("document_types")
    .select("id, code, name, is_active, created_at, updated_at")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row: DbDocumentType) => mapDocumentType(row));
}

export async function getAdminCounts(
  supabase: SupabaseClient,
): Promise<AdminCounts> {
  const [customers, workshops, invoices, services] = await Promise.all([
    countTable(supabase, "customers"),
    countTable(supabase, "workshops"),
    countTable(supabase, "invoices"),
    countTable(supabase, "services"),
  ]);

  return { customers, workshops, invoices, services };
}

async function countTable(
  supabase: SupabaseClient,
  table: "customers" | "workshops" | "invoices" | "services",
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}
