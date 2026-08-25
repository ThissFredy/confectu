import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Workshop,
  WorkshopSettings,
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

export async function listWorkshopsWithSettings(
  supabase: SupabaseClient,
): Promise<WorkshopWithSettings[]> {
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

  const items = workshops.map((workshop) => ({
    workshop: mapWorkshop(workshop),
    settings: settingsByWorkshop.get(workshop.id) ?? null,
  }));

  items.sort((a, b) => {
    const nameA = a.settings?.businessName ?? "";
    const nameB = b.settings?.businessName ?? "";
    return nameA.localeCompare(nameB);
  });

  return items;
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


