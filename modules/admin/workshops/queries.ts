import type { SupabaseClient } from "@supabase/supabase-js";
import type { Customer } from "@/modules/clients/types";
import type { Service } from "@/modules/services/types";
import { mapService, type DbService } from "@/modules/services/queries";
import type {
  Workshop,
  WorkshopSettings,
  WorkshopWithDetails,
  WorkshopWithSettings,
} from "./types";

interface DbWorkshop {
  id: string;
  owner_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DbWorkshopSettings {
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

function mapWorkshop(row: DbWorkshop): Workshop {
  return {
    id: row.id,
    ownerId: row.owner_id,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSettings(row: DbWorkshopSettings): WorkshopSettings {
  return {
    workshopId: row.workshop_id,
    businessName: row.business_name,
    taxId: row.tax_id,
    phone: row.phone,
    email: row.email,
    address: row.address,
    invoicePrefix: row.invoice_prefix,
    nextInvoiceNumber: Number(row.next_invoice_number),
    paymentInstructions: row.payment_instructions,
    logoPath: row.logo_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

export async function listWorkshops(
  supabase: SupabaseClient,
): Promise<Workshop[]> {
  const { data, error } = await supabase
    .from("workshops")
    .select("id, owner_id, is_active, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row: DbWorkshop) => mapWorkshop(row));
}

export async function getWorkshopById(
  supabase: SupabaseClient,
  id: string,
): Promise<WorkshopWithSettings | null> {
  const { data: workshopData, error: workshopError } = await supabase
    .from("workshops")
    .select("id, owner_id, is_active, created_at, updated_at")
    .eq("id", id)
    .single();

  if (workshopError || !workshopData) {
    return null;
  }

  const { data: settingsData, error: settingsError } = await supabase
    .from("workshop_settings")
    .select(
      "workshop_id, business_name, tax_id, phone, email, address, invoice_prefix, next_invoice_number, payment_instructions, logo_path, created_at, updated_at",
    )
    .eq("workshop_id", id)
    .single();

  if (settingsError) {
    return null;
  }

  return {
    workshop: mapWorkshop(workshopData as DbWorkshop),
    settings: settingsData ? mapSettings(settingsData as DbWorkshopSettings) : null,
  };
}

export async function getWorkshopLogoUrl(
  supabase: SupabaseClient,
  logoPath: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("workshop-logos")
    .createSignedUrl(logoPath, 60);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export async function listWorkshopsWithDetails(
  supabase: SupabaseClient,
): Promise<WorkshopWithDetails[]> {
  const { data: workshopsData, error: workshopsError } = await supabase
    .from("workshops")
    .select("id, owner_id, is_active, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (workshopsError) {
    throw new Error(workshopsError.message);
  }

  const workshops = (workshopsData ?? []) as DbWorkshop[];

  if (workshops.length === 0) {
    return [];
  }

  const workshopIds = workshops.map((workshop) => workshop.id);

  const { data: settingsData, error: settingsError } = await supabase
    .from("workshop_settings")
    .select(
      "workshop_id, business_name, tax_id, phone, email, address, invoice_prefix, next_invoice_number, payment_instructions, logo_path, created_at, updated_at",
    )
    .in("workshop_id", workshopIds);

  if (settingsError) {
    throw new Error(settingsError.message);
  }

  const settingsByWorkshop = new Map<string, WorkshopSettings>();

  for (const row of (settingsData ?? []) as DbWorkshopSettings[]) {
    settingsByWorkshop.set(row.workshop_id, mapSettings(row));
  }

  const { data: customersData, error: customersError } = await supabase
    .from("customers")
    .select(
      "id, workshop_id, name, document_type_id, document_number, phone, email, address, notes, is_active, created_at, updated_at, document_types(name)",
    )
    .in("workshop_id", workshopIds)
    .order("name", { ascending: true });

  if (customersError) {
    throw new Error(customersError.message);
  }

  const customersByWorkshop = new Map<string, Customer[]>();

  for (const row of (customersData ?? []) as DbCustomer[]) {
    const list = customersByWorkshop.get(row.workshop_id) ?? [];
    list.push(mapCustomer(row));
    customersByWorkshop.set(row.workshop_id, list);
  }

  const { data: servicesData, error: servicesError } = await supabase
    .from("services")
    .select(
      "id, workshop_id, name, description, category, default_price_cop, is_active, created_at, updated_at",
    )
    .in("workshop_id", workshopIds)
    .order("name", { ascending: true });

  if (servicesError) {
    throw new Error(servicesError.message);
  }

  const servicesByWorkshop = new Map<string, Service[]>();

  for (const row of (servicesData ?? []) as DbService[]) {
    const list = servicesByWorkshop.get(row.workshop_id) ?? [];
    list.push(mapService(row));
    servicesByWorkshop.set(row.workshop_id, list);
  }

  const items = workshops.map((workshop) => ({
    workshop: mapWorkshop(workshop),
    settings: settingsByWorkshop.get(workshop.id) ?? null,
    customers: customersByWorkshop.get(workshop.id) ?? [],
    services: servicesByWorkshop.get(workshop.id) ?? [],
  }));

  items.sort((a, b) => {
    const nameA = a.settings?.businessName ?? "";
    const nameB = b.settings?.businessName ?? "";
    return nameA.localeCompare(nameB);
  });

  return items;
}
