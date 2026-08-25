"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveAuthState } from "@/modules/auth/queries";
import { validateWorkshopSettingsInput } from "./validations";
import type { WorkshopActionResult, WorkshopSettingsInput } from "./types";

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
    paymentInstructions: (() => {
      const value = formData.get("payment_instructions");
      return typeof value === "string" && value.length > 0 ? value : null;
    })(),
  };
}

export async function updateMyWorkshopSettings(
  formData: FormData,
): Promise<WorkshopActionResult> {
  const supabase = await createClient();
  const authState = await resolveAuthState(supabase);

  if (authState.status === "unauthenticated") {
    return { success: false, error: "No hay sesión activa." };
  }

  if (authState.status === "inactive") {
    return { success: false, error: "Tu cuenta está desactivada." };
  }

  if (authState.profile?.role !== "CLIENT") {
    return {
      success: false,
      error: "Solo los propietarios de taller pueden realizar esta acción.",
    };
  }

  const { data: workshop } = await supabase
    .from("workshops")
    .select("id, is_active")
    .eq("owner_id", authState.profile.id)
    .single();

  if (!workshop || !workshop.is_active) {
    return {
      success: false,
      error: "No se encontró un taller activo asociado a tu cuenta.",
    };
  }

  const workshopId = workshop.id;

  const { data: existingSettings } = await supabase
    .from("workshop_settings")
    .select("logo_path, next_invoice_number")
    .eq("workshop_id", workshopId)
    .single();

  if (!existingSettings) {
    return {
      success: false,
      error: "No se encontró la configuración del taller.",
    };
  }

  const input = parseWorkshopSettingsInput(formData);
  const validation = validateWorkshopSettingsInput(input);

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

  revalidatePath("/settings");
  return { success: true };
}
