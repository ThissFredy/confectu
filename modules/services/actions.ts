"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveAuthState } from "@/modules/auth/queries";
import { validateServiceInput } from "./validations";
import type { ServiceActionResult, ServiceInput } from "./types";

const FOREIGN_KEY_VIOLATION_ERROR = "23503";

async function requireClient(): Promise<
  | { valid: false; result: ServiceActionResult }
  | { valid: true; workshopId: string }
> {
  const supabase = await createClient();
  const authState = await resolveAuthState(supabase);

  if (authState.status === "unauthenticated") {
    return { valid: false, result: { success: false, error: "No hay sesión activa." } };
  }

  if (authState.status === "inactive") {
    return { valid: false, result: { success: false, error: "Tu cuenta está desactivada." } };
  }

  if (authState.profile?.role !== "CLIENT") {
    return { valid: false, result: { success: false, error: "No tienes permiso para realizar esta acción." } };
  }

  const { data: workshop } = await supabase
    .from("workshops")
    .select("id")
    .eq("owner_id", authState.profile.id)
    .maybeSingle();

  if (!workshop) {
    return { valid: false, result: { success: false, error: "No se encontró el taller asociado." } };
  }

  return { valid: true, workshopId: workshop.id };
}

function parseServiceInput(formData: FormData): ServiceInput {
  return {
    name: String(formData.get("name") ?? ""),
    description: (() => {
      const value = formData.get("description");
      return typeof value === "string" && value.length > 0 ? value : null;
    })(),
    category: (() => {
      const value = formData.get("category");
      return typeof value === "string" && value.length > 0 ? value : null;
    })(),
    defaultPriceCop: Number(String(formData.get("default_price_cop") ?? "0").replace(/,/g, "")) || 0,
  };
}

function parseCurrencyValue(formData: FormData): number {
  const raw = String(formData.get("default_price_cop") ?? "0").replace(/,/g, "");
  const value = Number(raw);
  return Number.isNaN(value) ? Number.NaN : value;
}

export async function createService(
  formData: FormData,
): Promise<ServiceActionResult> {
  const auth = await requireClient();
  if (!auth.valid) {
    return auth.result;
  }

  const input = {
    ...parseServiceInput(formData),
    defaultPriceCop: parseCurrencyValue(formData),
  };
  const validation = validateServiceInput(input);

  if (!validation.valid) {
    return validation.result;
  }

  const supabase = await createClient();

  const { error } = await supabase.from("services").insert({
    workshop_id: auth.workshopId,
    name: input.name.trim(),
    description: input.description,
    category: input.category,
    default_price_cop: input.defaultPriceCop,
    is_active: true,
  });

  if (error) {
    return {
      success: false,
      error: "No se pudo crear el servicio. Intenta de nuevo.",
    };
  }

  revalidatePath("/services");
  return { success: true };
}

export async function updateService(
  formData: FormData,
): Promise<ServiceActionResult> {
  const auth = await requireClient();
  if (!auth.valid) {
    return auth.result;
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return { success: false, error: "El identificador es obligatorio." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("services")
    .select("id, workshop_id")
    .eq("id", id)
    .single();

  if (!existing || existing.workshop_id !== auth.workshopId) {
    return { success: false, error: "El servicio no existe o no pertenece a tu taller." };
  }

  const input = {
    ...parseServiceInput(formData),
    defaultPriceCop: parseCurrencyValue(formData),
  };
  const validation = validateServiceInput(input);

  if (!validation.valid) {
    return validation.result;
  }

  const { error } = await supabase
    .from("services")
    .update({
      name: input.name.trim(),
      description: input.description,
      category: input.category,
      default_price_cop: input.defaultPriceCop,
    })
    .eq("id", id);

  if (error) {
    return {
      success: false,
      error: "No se pudo actualizar el servicio. Intenta de nuevo.",
    };
  }

  revalidatePath("/services");
  revalidatePath(`/services/${id}`);
  return { success: true };
}

export async function toggleServiceStatus(
  formData: FormData,
): Promise<ServiceActionResult> {
  const auth = await requireClient();
  if (!auth.valid) {
    return auth.result;
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return { success: false, error: "El identificador es obligatorio." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("services")
    .select("id, is_active, workshop_id")
    .eq("id", id)
    .single();

  if (!existing || existing.workshop_id !== auth.workshopId) {
    return { success: false, error: "El servicio no existe o no pertenece a tu taller." };
  }

  const { error } = await supabase
    .from("services")
    .update({ is_active: !existing.is_active })
    .eq("id", id);

  if (error) {
    return {
      success: false,
      error: "No se pudo actualizar el estado. Intenta de nuevo.",
    };
  }

  revalidatePath("/services");
  revalidatePath(`/services/${id}`);
  return { success: true };
}

export async function deleteService(
  formData: FormData,
): Promise<ServiceActionResult> {
  const auth = await requireClient();
  if (!auth.valid) {
    return auth.result;
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return { success: false, error: "El identificador es obligatorio." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("services")
    .select("id, workshop_id")
    .eq("id", id)
    .single();

  if (!existing || existing.workshop_id !== auth.workshopId) {
    return { success: false, error: "El servicio no existe o no pertenece a tu taller." };
  }

  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", id);

  if (error) {
    if (error.code === FOREIGN_KEY_VIOLATION_ERROR) {
      return {
        success: false,
        error: "No se puede eliminar el servicio porque está referenciado por facturas. Considera desactivarlo.",
      };
    }

    return {
      success: false,
      error: "No se pudo eliminar el servicio. Intenta de nuevo.",
    };
  }

  revalidatePath("/services");
  return { success: true };
}
