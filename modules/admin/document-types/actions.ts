"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveAuthState } from "@/modules/auth/queries";
import { validateDocumentTypeInput } from "./validations";
import type { DocumentTypeActionResult } from "./types";

const DUPLICATE_KEY_ERROR = "23505";

async function requireAdmin(): Promise<DocumentTypeActionResult | null> {
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

export async function createDocumentType(
  formData: FormData,
): Promise<DocumentTypeActionResult> {
  const authError = await requireAdmin();
  if (authError) {
    return authError;
  }

  const code = String(formData.get("code") ?? "").toUpperCase().trim();
  const name = String(formData.get("name") ?? "").trim();

  const validation = validateDocumentTypeInput({ code, name });
  if (!validation.valid) {
    return validation.result;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("document_types").insert({
    code,
    name,
    is_active: true,
  });

  if (error) {
    if (error.code === DUPLICATE_KEY_ERROR) {
      return {
        success: false,
        fieldErrors: { code: "Este código ya existe." },
      };
    }

    return {
      success: false,
      error: "No se pudo crear el tipo de documento. Intenta de nuevo.",
    };
  }

  revalidatePath("/admin/document-types");
  return { success: true };
}

export async function updateDocumentType(
  formData: FormData,
): Promise<DocumentTypeActionResult> {
  const authError = await requireAdmin();
  if (authError) {
    return authError;
  }

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    return { success: false, error: "El identificador es obligatorio." };
  }

  const code = String(formData.get("code") ?? "").toUpperCase().trim();
  const name = String(formData.get("name") ?? "").trim();

  const validation = validateDocumentTypeInput({ code, name });
  if (!validation.valid) {
    return validation.result;
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("document_types")
    .select("id")
    .eq("id", id)
    .single();

  if (!existing) {
    return { success: false, error: "El tipo de documento no existe." };
  }

  const { error } = await supabase
    .from("document_types")
    .update({ code, name })
    .eq("id", id);

  if (error) {
    if (error.code === DUPLICATE_KEY_ERROR) {
      return {
        success: false,
        fieldErrors: { code: "Este código ya existe." },
      };
    }

    return {
      success: false,
      error: "No se pudo actualizar el tipo de documento. Intenta de nuevo.",
    };
  }

  revalidatePath("/admin/document-types");
  revalidatePath(`/admin/document-types/${id}`);
  return { success: true };
}

export async function toggleDocumentTypeStatus(
  formData: FormData,
): Promise<DocumentTypeActionResult> {
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
    .from("document_types")
    .select("id, is_active")
    .eq("id", id)
    .single();

  if (!existing) {
    return { success: false, error: "El tipo de documento no existe." };
  }

  const { error } = await supabase
    .from("document_types")
    .update({ is_active: !existing.is_active })
    .eq("id", id);

  if (error) {
    return {
      success: false,
      error: "No se pudo actualizar el estado. Intenta de nuevo.",
    };
  }

  revalidatePath("/admin/document-types");
  revalidatePath(`/admin/document-types/${id}`);
  return { success: true };
}
