import type { SupabaseClient } from "@supabase/supabase-js";
import type { Service } from "./types";

interface DbService {
  id: string;
  workshop_id: string;
  name: string;
  description: string | null;
  category: string | null;
  default_price_cop: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function mapService(row: DbService): Service {
  return {
    id: row.id,
    workshopId: row.workshop_id,
    name: row.name,
    description: row.description,
    category: row.category,
    defaultPriceCop: Number(row.default_price_cop),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ListServicesOptions {
  includeInactive?: boolean;
}

export async function listServices(
  supabase: SupabaseClient,
  options: ListServicesOptions = {},
): Promise<Service[]> {
  const { includeInactive = false } = options;

  let query = supabase
    .from("services")
    .select(
      "id, workshop_id, name, description, category, default_price_cop, is_active, created_at, updated_at",
    )
    .order("name", { ascending: true });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row: DbService) => mapService(row));
}

export async function getServiceById(
  supabase: SupabaseClient,
  id: string,
): Promise<Service | null> {
  const { data, error } = await supabase
    .from("services")
    .select(
      "id, workshop_id, name, description, category, default_price_cop, is_active, created_at, updated_at",
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return mapService(data as DbService);
}

export async function listActiveServices(
  supabase: SupabaseClient,
): Promise<Service[]> {
  const { data, error } = await supabase
    .from("services")
    .select(
      "id, workshop_id, name, description, category, default_price_cop, is_active, created_at, updated_at",
    )
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row: DbService) => mapService(row));
}

export async function listServicesByWorkshop(
  supabase: SupabaseClient,
  workshopId: string,
): Promise<Service[]> {
  const { data, error } = await supabase
    .from("services")
    .select(
      "id, workshop_id, name, description, category, default_price_cop, is_active, created_at, updated_at",
    )
    .eq("workshop_id", workshopId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row: DbService) => mapService(row));
}
