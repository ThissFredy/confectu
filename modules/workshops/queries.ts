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

export async function getCurrentWorkshop(
  supabase: SupabaseClient,
): Promise<Workshop | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("workshops")
    .select("id, owner_id, is_active, created_at, updated_at")
    .eq("owner_id", user.id)
    .single();

  if (error || !data) {
    return null;
  }

  return mapWorkshop(data as DbWorkshop);
}

export async function getCurrentWorkshopSettings(
  supabase: SupabaseClient,
): Promise<WorkshopSettings | null> {
  const workshop = await getCurrentWorkshop(supabase);

  if (!workshop) {
    return null;
  }

  const { data, error } = await supabase
    .from("workshop_settings")
    .select(
      "workshop_id, business_name, tax_id, phone, email, address, invoice_prefix, next_invoice_number, payment_instructions, logo_path, created_at, updated_at",
    )
    .eq("workshop_id", workshop.id)
    .single();

  if (error || !data) {
    return null;
  }

  return mapSettings(data as DbWorkshopSettings);
}

export async function getCurrentWorkshopWithSettings(
  supabase: SupabaseClient,
): Promise<WorkshopWithSettings | null> {
  const workshop = await getCurrentWorkshop(supabase);

  if (!workshop) {
    return null;
  }

  const { data, error } = await supabase
    .from("workshop_settings")
    .select(
      "workshop_id, business_name, tax_id, phone, email, address, invoice_prefix, next_invoice_number, payment_instructions, logo_path, created_at, updated_at",
    )
    .eq("workshop_id", workshop.id)
    .single();

  if (error) {
    return {
      workshop,
      settings: null,
    };
  }

  return {
    workshop,
    settings: data ? mapSettings(data as DbWorkshopSettings) : null,
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
