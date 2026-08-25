"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveAuthState } from "@/modules/auth/queries";
import { listCustomersByWorkshop } from "@/modules/admin/clients/queries";
import { listServicesByWorkshop } from "@/modules/services/queries";
import {
  validateWorkshopSettingsInput,
  type WorkshopSettingsInput,
} from "./validations";
import type { WorkshopActionResult, WorkshopDetailsResult } from "./types";

const LOGO_MAX_SIZE = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const DUPLICATE_KEY_ERROR = "23505";

function getLogoExtension(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

async function requireAdmin(): Promise<WorkshopActionResult | null> {
  const supabase = await createClient();
  const authState = await resolveAuthState(supabase);

  if (authState.status === "unauthenticated") {
    return { success: false, error: "No hay sesión activa." };
  }

  if (authState.status === "inactive") {
    return { success: false, error: "Tu cuenta está desactivada." };
  }

  if (authState.profile?.role !== "ADMIN") {
    return {
      success: false,
      error: "Solo los administradores pueden realizar esta acción.",
    };
  }

  return null;
}

export async function toggleWorkshopStatus(
  formData: FormData,
): Promise<WorkshopActionResult> {
  const authError = await requireAdmin();
  if (authError) {
    return authError;
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return { success: false, error: "El identificador es obligatorio." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("workshops")
    .select("id, is_active")
    .eq("id", id)
    .single();

  if (!existing) {
    return { success: false, error: "El taller no existe." };
  }

  const { error } = await supabase
    .from("workshops")
    .update({ is_active: !existing.is_active })
    .eq("id", id);

  if (error) {
    return {
      success: false,
      error: "No se pudo actualizar el estado. Intenta de nuevo.",
    };
  }

  revalidatePath("/admin/workshops");
  revalidatePath(`/admin/workshops/${id}`);
  return { success: true };
}

export async function getWorkshopDetails(
  formData: FormData,
): Promise<WorkshopDetailsResult | { success: false; error: string }> {
  const authError = await requireAdmin();
  if (authError) {
    return { success: false, error: authError.error ?? "No autorizado." };
  }

  const workshopId = String(formData.get("workshop_id") ?? "").trim();
  if (!workshopId) {
    return { success: false, error: "El taller es obligatorio." };
  }

  const supabase = await createClient();

  try {
    const [customers, services] = await Promise.all([
      listCustomersByWorkshop(supabase, workshopId),
      listServicesByWorkshop(supabase, workshopId),
    ]);

    return { success: true, customers, services };
  } catch {
    return {
      success: false,
      error: "No se pudieron cargar los datos del taller.",
    };
  }
}


function parseWorkshopSettingsInput(formData: FormData): WorkshopSettingsInput {
  return {
    businessName: String(formData.get("business_name") ?? ""),
    taxId: (() => {
      const value = formData.get("tax_id");
      return typeof value === "string" && value.length > 0 ? value : null;
    })(),
    phone: (() => {
      const value = formData.get("phone");
      return typeof value === "string" && value.length > 0 ? value : null;
    })(),
    email: (() => {
      const value = formData.get("email");
      return typeof value === "string" && value.length > 0 ? value : null;
    })(),
    address: (() => {
      const value = formData.get("address");
      return typeof value === "string" && value.length > 0 ? value : null;
    })(),
    invoicePrefix: String(formData.get("invoice_prefix") ?? ""),
    nextInvoiceNumber: Number(formData.get("next_invoice_number") ?? ""),
    paymentInstructions: (() => {
      const value = formData.get("payment_instructions");
      return typeof value === "string" && value.length > 0 ? value : null;
    })(),
  };
}

export async function updateWorkshopSettings(
  formData: FormData,
): Promise<WorkshopActionResult> {
  const authError = await requireAdmin();
  if (authError) {
    return authError;
  }

  const workshopId = String(formData.get("workshop_id") ?? "").trim();
  if (!workshopId) {
    return { success: false, error: "El taller es obligatorio." };
  }

  const supabase = await createClient();

  const { data: existingSettings } = await supabase
    .from("workshop_settings")
    .select("next_invoice_number, logo_path")
    .eq("workshop_id", workshopId)
    .single();

  if (!existingSettings) {
    return { success: false, error: "El taller no existe." };
  }

  const input = parseWorkshopSettingsInput(formData);
  const currentNextInvoiceNumber = Number(existingSettings.next_invoice_number);

  const validation = validateWorkshopSettingsInput(
    input,
    currentNextInvoiceNumber,
  );
  if (!validation.valid) {
    return validation.result;
  }

  const logoFile = formData.get("logo");
  const wantsRemoveLogo = formData.get("remove_logo") === "true";
  let newLogoPath: string | null = existingSettings.logo_path;

  if (logoFile instanceof Blob && logoFile.size > 0) {
    if (!ALLOWED_LOGO_TYPES.includes(logoFile.type)) {
      return {
        success: false,
        error: "El logo debe ser una imagen PNG, JPEG o WebP.",
      };
    }

    if (logoFile.size > LOGO_MAX_SIZE) {
      return {
        success: false,
        error: "El logo no puede superar 2 MB.",
      };
    }

    const ext = getLogoExtension(logoFile.type);
    const path = `${workshopId}/logo.${ext}`;

    if (existingSettings.logo_path) {
      await supabase.storage
        .from("workshop-logos")
        .remove([existingSettings.logo_path]);
    }

    const { error: uploadError } = await supabase.storage
      .from("workshop-logos")
      .upload(path, logoFile, {
        contentType: logoFile.type,
        upsert: false,
      });

    if (uploadError) {
      return {
        success: false,
        error: "No se pudo subir el logo. Intenta de nuevo.",
      };
    }

    newLogoPath = path;
  } else if (wantsRemoveLogo && existingSettings.logo_path) {
    const { error: removeError } = await supabase.storage
      .from("workshop-logos")
      .remove([existingSettings.logo_path]);

    if (removeError) {
      return {
        success: false,
        error: "No se pudo eliminar el logo. Intenta de nuevo.",
      };
    }

    newLogoPath = null;
  }

  const { error } = await supabase
    .from("workshop_settings")
    .update({
      business_name: input.businessName.trim(),
      tax_id: input.taxId,
      phone: input.phone,
      email: input.email,
      address: input.address,
      invoice_prefix: input.invoicePrefix.trim().toUpperCase(),
      next_invoice_number: input.nextInvoiceNumber,
      payment_instructions: input.paymentInstructions,
      logo_path: newLogoPath,
    })
    .eq("workshop_id", workshopId);

  if (error) {
    if (newLogoPath && newLogoPath !== existingSettings.logo_path) {
      await supabase.storage.from("workshop-logos").remove([newLogoPath]);
    }

    if (error.code === DUPLICATE_KEY_ERROR) {
      return {
        success: false,
        fieldErrors: {
          business_name: "Ya existe un taller con este nombre comercial.",
        },
      };
    }

    return {
      success: false,
      error: "No se pudo actualizar la configuración. Intenta de nuevo.",
    };
  }

  revalidatePath("/admin/workshops");
  revalidatePath(`/admin/workshops/${workshopId}`);
  return { success: true };
}

export async function uploadWorkshopLogo(
  formData: FormData,
): Promise<WorkshopActionResult> {
  const authError = await requireAdmin();
  if (authError) {
    return authError;
  }

  const workshopId = String(formData.get("workshop_id") ?? "").trim();
  if (!workshopId) {
    return { success: false, error: "El taller es obligatorio." };
  }

  const logo = formData.get("logo");
  if (!(logo instanceof Blob) || logo.size === 0) {
    return { success: false, error: "Debes seleccionar una imagen." };
  }

  if (!ALLOWED_LOGO_TYPES.includes(logo.type)) {
    return {
      success: false,
      error: "El logo debe ser una imagen PNG, JPEG o WebP.",
    };
  }

  if (logo.size > LOGO_MAX_SIZE) {
    return {
      success: false,
      error: "El logo no puede superar 2 MB.",
    };
  }

  const supabase = await createClient();

  const { data: existingSettings } = await supabase
    .from("workshop_settings")
    .select("logo_path")
    .eq("workshop_id", workshopId)
    .single();

  if (!existingSettings) {
    return { success: false, error: "El taller no existe." };
  }

  const ext = getLogoExtension(logo.type);
  const path = `${workshopId}/logo.${ext}`;

  if (existingSettings.logo_path) {
    await supabase.storage
      .from("workshop-logos")
      .remove([existingSettings.logo_path]);
  }

  const { error: uploadError } = await supabase.storage
    .from("workshop-logos")
    .upload(path, logo, {
      contentType: logo.type,
      upsert: false,
    });

  if (uploadError) {
    return {
      success: false,
      error: "No se pudo subir el logo. Intenta de nuevo.",
    };
  }

  const { error: updateError } = await supabase
    .from("workshop_settings")
    .update({ logo_path: path })
    .eq("workshop_id", workshopId);

  if (updateError) {
    await supabase.storage.from("workshop-logos").remove([path]);
    return {
      success: false,
      error: "No se pudo guardar el logo. Intenta de nuevo.",
    };
  }

  revalidatePath("/admin/workshops");
  revalidatePath(`/admin/workshops/${workshopId}`);
  return { success: true };
}

export async function removeWorkshopLogo(
  formData: FormData,
): Promise<WorkshopActionResult> {
  const authError = await requireAdmin();
  if (authError) {
    return authError;
  }

  const workshopId = String(formData.get("workshop_id") ?? "").trim();
  if (!workshopId) {
    return { success: false, error: "El taller es obligatorio." };
  }

  const supabase = await createClient();

  const { data: existingSettings } = await supabase
    .from("workshop_settings")
    .select("logo_path")
    .eq("workshop_id", workshopId)
    .single();

  if (!existingSettings) {
    return { success: false, error: "El taller no existe." };
  }

  if (existingSettings.logo_path) {
    const { error: removeError } = await supabase.storage
      .from("workshop-logos")
      .remove([existingSettings.logo_path]);

    if (removeError) {
      return {
        success: false,
        error: "No se pudo eliminar el logo. Intenta de nuevo.",
      };
    }
  }

  const { error } = await supabase
    .from("workshop_settings")
    .update({ logo_path: null })
    .eq("workshop_id", workshopId);

  if (error) {
    return {
      success: false,
      error: "No se pudo actualizar la configuración. Intenta de nuevo.",
    };
  }

  revalidatePath("/admin/workshops");
  revalidatePath(`/admin/workshops/${workshopId}`);
  return { success: true };
}
