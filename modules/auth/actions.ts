"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveAuthState } from "./queries";
import { isInternalRoute, validateWorkshopSetup } from "./validations";
import type { AuthActionResult } from "./types";

export async function signInWithGoogle(formData: FormData): Promise<never> {
  const supabase = await createClient();
  const headersList = await headers();
  const origin =
    headersList.get("origin") ??
    `https://${headersList.get("host") ?? "localhost"}`;

  const next = formData.get("next");
  const nextParam =
    typeof next === "string" && isInternalRoute(next)
      ? `?next=${encodeURIComponent(next)}`
      : "";

  const redirectTo = `${origin}/api/auth/callback${nextParam}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  if (error || !data.url) {
    throw new Error("No se pudo iniciar sesión con Google. Intenta de nuevo.");
  }

  redirect(data.url);
}

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function completeWorkshopSetup(
  formData: FormData,
): Promise<AuthActionResult> {
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
      error: "Solo los talleristas pueden completar esta configuración.",
    };
  }

  if (authState.profile.workshopSetupCompleted) {
    return { success: false, error: "Ya configuraste tu taller." };
  }

  const businessName =
    typeof formData.get("business_name") === "string"
      ? (formData.get("business_name") as string)
      : "";
  const invoicePrefix =
    typeof formData.get("invoice_prefix") === "string"
      ? (formData.get("invoice_prefix") as string).toUpperCase()
      : "";

  const validation = validateWorkshopSetup({ businessName, invoicePrefix });
  if (!validation.valid) {
    return validation.result;
  }

  const { error } = await supabase.rpc("complete_workshop_setup", {
    p_business_name: businessName.trim(),
    p_invoice_prefix: invoicePrefix,
  });

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return { success: true };
}
