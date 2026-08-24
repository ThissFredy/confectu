"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveAuthState } from "@/modules/auth/queries";
import { validateCustomerInput } from "@/modules/clients/validations";
import type { CustomerActionResult, CustomerInput } from "./types";

const DUPLICATE_KEY_ERROR = "23505";

async function requireAdmin(): Promise<CustomerActionResult | null> {
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

async function validateDocumentType(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentTypeId: string | null,
): Promise<boolean> {
  if (!documentTypeId) {
    return true;
  }

  const { data } = await supabase
    .from("document_types")
    .select("id")
    .eq("id", documentTypeId)
    .eq("is_active", true)
    .single();

  return Boolean(data);
}

function parseCustomerInput(formData: FormData): CustomerInput {
  return {
    name: String(formData.get("name") ?? ""),
    documentTypeId: (() => {
      const value = formData.get("document_type_id");
      return typeof value === "string" && value.length > 0 ? value : null;
    })(),
    documentNumber: (() => {
      const value = formData.get("document_number");
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
    notes: (() => {
      const value = formData.get("notes");
      return typeof value === "string" && value.length > 0 ? value : null;
    })(),
  };
}

export async function updateCustomerAsAdmin(
  formData: FormData,
): Promise<CustomerActionResult> {
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
    .from("customers")
    .select("id, workshop_id")
    .eq("id", id)
    .single();

  if (!existing) {
    return { success: false, error: "El cliente no existe." };
  }

  const input = parseCustomerInput(formData);
  const validation = validateCustomerInput(input);

  if (!validation.valid) {
    return validation.result;
  }

  if (input.documentTypeId) {
    const isActive = await validateDocumentType(supabase, input.documentTypeId);
    if (!isActive) {
      return {
        success: false,
        fieldErrors: {
          document_type_id: "El tipo de documento seleccionado no está activo.",
        },
      };
    }
  }

  const { error } = await supabase
    .from("customers")
    .update({
      name: input.name.trim(),
      document_type_id: input.documentTypeId,
      document_number: input.documentNumber,
      phone: input.phone,
      email: input.email,
      address: input.address,
      notes: input.notes,
    })
    .eq("id", id);

  if (error) {
    if (error.code === DUPLICATE_KEY_ERROR) {
      return {
        success: false,
        fieldErrors: {
          document_number: "Ya existe un cliente con este documento en el taller.",
        },
      };
    }

    return {
      success: false,
      error: "No se pudo actualizar el cliente. Intenta de nuevo.",
    };
  }

  revalidatePath("/admin/workshops");
  revalidatePath(`/admin/workshops/${existing.workshop_id}`);
  revalidatePath(`/admin/workshops/${existing.workshop_id}/customers/${id}`);
  return { success: true };
}

export async function toggleCustomerStatusAsAdmin(
  formData: FormData,
): Promise<CustomerActionResult> {
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
    .from("customers")
    .select("id, is_active, workshop_id")
    .eq("id", id)
    .single();

  if (!existing) {
    return { success: false, error: "El cliente no existe." };
  }

  const { error } = await supabase
    .from("customers")
    .update({ is_active: !existing.is_active })
    .eq("id", id);

  if (error) {
    return {
      success: false,
      error: "No se pudo actualizar el estado. Intenta de nuevo.",
    };
  }

  revalidatePath("/admin/workshops");
  revalidatePath(`/admin/workshops/${existing.workshop_id}`);
  revalidatePath(`/admin/workshops/${existing.workshop_id}/customers/${id}`);
  return { success: true };
}
