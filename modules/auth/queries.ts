import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthState, AuthUser, Profile, WorkshopSettings } from "./types";

export async function getProfile(
  supabase: SupabaseClient,
): Promise<Profile | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, is_active, workshop_setup_completed, created_at, updated_at")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    role: data.role,
    isActive: data.is_active,
    workshopSetupCompleted: data.workshop_setup_completed,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function resolveAuthState(
  supabase: SupabaseClient,
): Promise<AuthState> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, profile: null, status: "unauthenticated" };
  }

  const authUser: AuthUser = {
    id: user.id,
    email: user.email ?? null,
    name:
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      null,
    avatarUrl:
      (user.user_metadata?.avatar_url as string | undefined) ??
      (user.user_metadata?.picture as string | undefined) ??
      null,
  };

  const profile = await getProfile(supabase);

  if (!profile) {
    return { user: authUser, profile: null, status: "unauthenticated" };
  }

  if (!profile.isActive) {
    return { user: authUser, profile, status: "inactive" };
  }

  if (profile.role === "CLIENT") {
    if (!profile.workshopSetupCompleted) {
      return { user: authUser, profile, status: "needs_onboarding" };
    }

    const { data: workshop } = await supabase
      .from("workshops")
      .select("is_active")
      .eq("owner_id", profile.id)
      .maybeSingle();

    if (!workshop || !workshop.is_active) {
      return { user: authUser, profile, status: "inactive" };
    }
  }

  return { user: authUser, profile, status: "active" };
}

export async function getWorkshopSettings(
  supabase: SupabaseClient,
): Promise<WorkshopSettings | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: workshop } = await supabase
    .from("workshops")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!workshop) {
    return null;
  }

  const { data, error } = await supabase
    .from("workshop_settings")
    .select(
      "workshop_id, business_name, tax_id, phone, email, address, invoice_prefix, next_invoice_number, payment_instructions, logo_path",
    )
    .eq("workshop_id", workshop.id)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    workshopId: data.workshop_id,
    businessName: data.business_name,
    taxId: data.tax_id,
    phone: data.phone,
    email: data.email,
    address: data.address,
    invoicePrefix: data.invoice_prefix,
    nextInvoiceNumber: Number(data.next_invoice_number),
    paymentInstructions: data.payment_instructions,
    logoPath: data.logo_path,
  };
}
