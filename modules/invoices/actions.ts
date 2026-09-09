"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveAuthState } from "@/modules/auth/queries";
import { getCurrentWorkshopSettings } from "@/modules/workshops/queries";
import { validateCustomerInput } from "@/modules/clients/validations";
import {
  calculateInvoiceTotals,
  MAX_ADJUSTMENTS,
  MAX_LINES,
  parseDecimal,
  validateInvoiceInput,
} from "./validations";
import type {
  CustomerFromInvoiceResult,
  InvoiceActionResult,
  InvoiceAdjustmentInput,
  InvoiceInput,
  InvoiceLineInput,
} from "./types";

const FOREIGN_KEY_VIOLATION_ERROR = "23503";
const UNIQUE_VIOLATION_ERROR = "23505";

interface ClientAuth {
  valid: true;
  workshopId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

type ClientAuthResult =
  | ClientAuth
  | { valid: false; result: InvoiceActionResult | CustomerFromInvoiceResult };

async function requireClient(): Promise<ClientAuthResult> {
  const supabase = await createClient();
  const authState = await resolveAuthState(supabase);

  if (authState.status === "unauthenticated") {
    return { valid: false, result: { success: false, error: "No hay sesión activa." } };
  }

  if (authState.status === "inactive") {
    return {
      valid: false,
      result: { success: false, error: "Tu cuenta está desactivada." },
    };
  }

  if (authState.status === "needs_onboarding") {
    return {
      valid: false,
      result: { success: false, error: "Debes completar la configuración de tu taller." },
    };
  }

  if (authState.profile?.role !== "CLIENT") {
    return {
      valid: false,
      result: { success: false, error: "No tienes permiso para realizar esta acción." },
    };
  }

  const { data: workshop } = await supabase
    .from("workshops")
    .select("id")
    .eq("owner_id", authState.profile.id)
    .maybeSingle();

  if (!workshop) {
    return {
      valid: false,
      result: { success: false, error: "No se encontró el taller asociado." },
    };
  }

  return { valid: true, workshopId: workshop.id, supabase };
}

function coerceInvoiceActionResult(
  result: CustomerFromInvoiceResult,
): InvoiceActionResult {
  return result;
}

function parseLineCount(formData: FormData): number {
  const raw = formData.get("line_count");
  const parsed = parseDecimal(raw);
  if (parsed === null) {
    return 0;
  }
  return Math.min(Math.floor(parsed), MAX_LINES + 1);
}

function parseAdjustmentCount(formData: FormData): number {
  const raw = formData.get("adj_count");
  const parsed = parseDecimal(raw);
  if (parsed === null) {
    return 0;
  }
  return Math.min(Math.floor(parsed), MAX_ADJUSTMENTS + 1);
}

function parseLines(formData: FormData): InvoiceLineInput[] {
  const count = parseLineCount(formData);
  const lines: InvoiceLineInput[] = [];

  for (let index = 0; index < count; index += 1) {
    const serviceIdRaw = formData.get(`line_${index}_service_id`);
    const serviceId =
      typeof serviceIdRaw === "string" && serviceIdRaw.trim().length > 0
        ? serviceIdRaw.trim()
        : null;

    const description = String(formData.get(`line_${index}_description`) ?? "");
    const quantity = parseDecimal(formData.get(`line_${index}_quantity`)) ?? 0;
    const unitPriceCop =
      parseDecimal(formData.get(`line_${index}_unit_price_cop`)) ?? 0;

    lines.push({
      serviceId,
      description,
      quantity,
      unitPriceCop,
    });
  }

  return lines;
}

function parseAdjustments(formData: FormData): InvoiceAdjustmentInput[] {
  const count = parseAdjustmentCount(formData);
  const adjustments: InvoiceAdjustmentInput[] = [];

  for (let index = 0; index < count; index += 1) {
    const label = String(formData.get(`adj_${index}_label`) ?? "");
    const category = String(formData.get(`adj_${index}_category`) ?? "");
    const mode = String(formData.get(`adj_${index}_mode`) ?? "");
    const value = parseDecimal(formData.get(`adj_${index}_value`)) ?? 0;

    adjustments.push({
      label,
      category: category as InvoiceAdjustmentInput["category"],
      mode: mode as InvoiceAdjustmentInput["mode"],
      value,
    });
  }

  return adjustments;
}

function parseInvoiceInput(formData: FormData): InvoiceInput {
  const customerId = String(formData.get("customer_id") ?? "").trim();
  const paymentMethodRaw = formData.get("payment_method");
  const paymentInstructionsRaw = formData.get("payment_instructions");
  const notesRaw = formData.get("notes");

  return {
    customerId,
    lines: parseLines(formData),
    adjustments: parseAdjustments(formData),
    paymentMethod:
      typeof paymentMethodRaw === "string" && paymentMethodRaw.trim().length > 0
        ? paymentMethodRaw.trim()
        : null,
    notes:
      typeof notesRaw === "string" && notesRaw.trim().length > 0
        ? notesRaw.trim()
        : null,
    paymentInstructions:
      typeof paymentInstructionsRaw === "string" &&
      paymentInstructionsRaw.trim().length > 0
        ? paymentInstructionsRaw.trim()
        : null,
  };
}

async function validateCustomerBelongsToWorkshop(
  supabase: Awaited<ReturnType<typeof createClient>>,
  customerId: string,
  workshopId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("customers")
    .select("id, workshop_id, is_active")
    .eq("id", customerId)
    .single();

  return !!data && data.workshop_id === workshopId;
}

async function validateServicesBelongToWorkshop(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lines: InvoiceLineInput[],
  workshopId: string,
): Promise<Record<string, string> | null> {
  const serviceIds = [
    ...new Set(
      lines
        .map((line) => line.serviceId)
        .filter((serviceId): serviceId is string => serviceId !== null),
    ),
  ];

  if (serviceIds.length === 0) {
    return null;
  }

  const { data } = await supabase
    .from("services")
    .select("id")
    .eq("workshop_id", workshopId)
    .in("id", serviceIds);

  const validIds = new Set((data ?? []).map((row) => row.id as string));
  const fieldErrors: Record<string, string> = {};
  let hasErrors = false;

  lines.forEach((line, index) => {
    if (line.serviceId && !validIds.has(line.serviceId)) {
      fieldErrors[`line_${index}_service_id`] =
        "El servicio no pertenece a tu taller.";
      hasErrors = true;
    }
  });

  return hasErrors ? fieldErrors : null;
}

function buildDraftRpcPayload(input: InvoiceInput) {
  return {
    p_customer_id: input.customerId,
    p_payment_method: input.paymentMethod,
    p_payment_instructions: input.paymentInstructions,
    p_notes: input.notes,
    p_lines: input.lines.map((line) => ({
      service_id: line.serviceId,
      description: line.description.trim(),
      quantity: line.quantity,
      unit_price_cop: line.unitPriceCop,
    })),
    p_adjustments: input.adjustments.map((adjustment) => ({
      label: adjustment.label.trim(),
      category: adjustment.category,
      mode: adjustment.mode,
      value: adjustment.value,
    })),
  };
}

function mapDraftRpcError(error: { message?: string }): InvoiceActionResult {
  const message = error.message ?? "";

  if (message.includes("customer does not belong")) {
    return {
      success: false,
      fieldErrors: {
        customer_id: "El cliente no existe o no pertenece a tu taller.",
      },
    };
  }

  if (message.includes("service does not belong")) {
    return {
      success: false,
      error: "Uno de los servicios no pertenece a tu taller.",
    };
  }

  if (message.includes("total cannot be negative")) {
    return { success: false, error: "El total no puede ser negativo." };
  }

  if (message.includes("only draft invoices can be updated")) {
    return { success: false, error: "Solo los borradores se pueden editar." };
  }

  if (message.includes("invoice does not belong")) {
    return {
      success: false,
      error: "La factura no existe o no pertenece a tu taller.",
    };
  }

  return {
    success: false,
    error: "No se pudo guardar el borrador. Intenta de nuevo.",
  };
}

export async function createInvoiceDraft(
  formData: FormData,
): Promise<InvoiceActionResult> {
  const auth = await requireClient();
  if (!auth.valid) {
    return coerceInvoiceActionResult(auth.result);
  }

  const input = parseInvoiceInput(formData);
  const validation = validateInvoiceInput(input);

  if (!validation.valid) {
    return validation.result;
  }

  const customerValid = await validateCustomerBelongsToWorkshop(
    auth.supabase,
    input.customerId,
    auth.workshopId,
  );

  if (!customerValid) {
    return {
      success: false,
      fieldErrors: { customer_id: "El cliente no existe o no pertenece a tu taller." },
    };
  }

  const serviceFieldErrors = await validateServicesBelongToWorkshop(
    auth.supabase,
    input.lines,
    auth.workshopId,
  );

  if (serviceFieldErrors) {
    return { success: false, fieldErrors: serviceFieldErrors };
  }

  const totals = calculateInvoiceTotals(input.lines, input.adjustments);
  if (!totals.valid) {
    return { success: false, error: totals.error };
  }

  const { data: invoiceId, error } = await auth.supabase.rpc(
    "create_invoice_draft",
    buildDraftRpcPayload(input),
  );

  if (error) {
    console.error("[invoices] createInvoiceDraft", error);
    return mapDraftRpcError(error);
  }

  revalidatePath("/invoices");
  return { success: true, invoiceId: invoiceId ?? undefined };
}

export async function updateInvoiceDraft(
  formData: FormData,
): Promise<InvoiceActionResult> {
  const auth = await requireClient();
  if (!auth.valid) {
    return coerceInvoiceActionResult(auth.result);
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return { success: false, error: "El identificador de la factura es obligatorio." };
  }

  const { data: existing } = await auth.supabase
    .from("invoices")
    .select("id, workshop_id, status")
    .eq("id", id)
    .eq("workshop_id", auth.workshopId)
    .single();

  if (!existing) {
    return { success: false, error: "La factura no existe o no pertenece a tu taller." };
  }

  if (existing.status !== "draft") {
    return { success: false, error: "Solo los borradores se pueden editar." };
  }

  const input = parseInvoiceInput(formData);
  const validation = validateInvoiceInput(input);

  if (!validation.valid) {
    return validation.result;
  }

  const customerValid = await validateCustomerBelongsToWorkshop(
    auth.supabase,
    input.customerId,
    auth.workshopId,
  );

  if (!customerValid) {
    return {
      success: false,
      fieldErrors: { customer_id: "El cliente no existe o no pertenece a tu taller." },
    };
  }

  const serviceFieldErrors = await validateServicesBelongToWorkshop(
    auth.supabase,
    input.lines,
    auth.workshopId,
  );

  if (serviceFieldErrors) {
    return { success: false, fieldErrors: serviceFieldErrors };
  }

  const totals = calculateInvoiceTotals(input.lines, input.adjustments);
  if (!totals.valid) {
    return { success: false, error: totals.error };
  }

  const { error } = await auth.supabase.rpc("update_invoice_draft", {
    p_invoice_id: id,
    ...buildDraftRpcPayload(input),
  });

  if (error) {
    console.error("[invoices] updateInvoiceDraft", error);
    return mapDraftRpcError(error);
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  return { success: true };
}

export async function issueInvoice(
  formData: FormData,
): Promise<InvoiceActionResult> {
  const auth = await requireClient();
  if (!auth.valid) {
    return coerceInvoiceActionResult(auth.result);
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return { success: false, error: "El identificador de la factura es obligatorio." };
  }

  const { data: existing } = await auth.supabase
    .from("invoices")
    .select("id, workshop_id, status, customer_id, payment_instructions")
    .eq("id", id)
    .eq("workshop_id", auth.workshopId)
    .single();

  if (!existing) {
    return { success: false, error: "La factura no existe o no pertenece a tu taller." };
  }

  if (existing.status !== "draft") {
    return { success: false, error: "Solo los borradores se pueden emitir." };
  }

  const paymentMethod = String(formData.get("payment_method") ?? "").trim();
  if (paymentMethod.length === 0) {
    return {
      success: false,
      fieldErrors: { payment_method: "El método de pago es obligatorio al emitir." },
    };
  }

  const { data: customer } = await auth.supabase
    .from("customers")
    .select("id, is_active")
    .eq("id", existing.customer_id)
    .single();

  if (!customer || !customer.is_active) {
    return {
      success: false,
      error: "El cliente no está activo. Reactívalo antes de emitir.",
    };
  }

  const { data: existingLines } = await auth.supabase
    .from("invoice_lines")
    .select("service_id, description_snapshot, quantity, unit_price_cop")
    .eq("invoice_id", id);

  const { data: existingAdjustments } = await auth.supabase
    .from("invoice_adjustments")
    .select("label, category, mode, value")
    .eq("invoice_id", id)
    .order("sort_order", { ascending: true });

  const lines: InvoiceLineInput[] = (existingLines ?? []).map((line) => ({
    serviceId: line.service_id,
    description: line.description_snapshot,
    quantity: Number(line.quantity),
    unitPriceCop: Number(line.unit_price_cop),
  }));

  const adjustments: InvoiceAdjustmentInput[] = (existingAdjustments ?? []).map(
    (adj) => ({
      label: adj.label,
      category: adj.category as InvoiceAdjustmentInput["category"],
      mode: adj.mode as InvoiceAdjustmentInput["mode"],
      value: Number(adj.value),
    }),
  );

  let paymentInstructions = String(
    formData.get("payment_instructions") ?? "",
  ).trim();

  if (paymentInstructions.length === 0) {
    paymentInstructions =
      typeof existing.payment_instructions === "string" &&
      existing.payment_instructions.trim().length > 0
        ? existing.payment_instructions.trim()
        : "";
  }

  if (paymentInstructions.length === 0) {
    const settings = await getCurrentWorkshopSettings(auth.supabase);
    paymentInstructions = settings?.paymentInstructions ?? "";
  }

  const input: InvoiceInput = {
    customerId: existing.customer_id,
    lines,
    adjustments,
    paymentMethod,
    paymentInstructions: paymentInstructions.length > 0 ? paymentInstructions : null,
    notes: null,
  };

  const validation = validateInvoiceInput(input);
  if (!validation.valid) {
    return validation.result;
  }

  const totals = calculateInvoiceTotals(lines, adjustments);
  if (!totals.valid) {
    return { success: false, error: totals.error };
  }

  if (totals.totals.totalCop < 0) {
    return { success: false, error: "El total no puede ser negativo." };
  }

  const { error: totalsError } = await auth.supabase
    .from("invoices")
    .update({
      subtotal_cop: totals.totals.subtotalCop,
      total_adjustments_cop: totals.totals.totalAdjustmentsCop,
      total_cop: totals.totals.totalCop,
      payment_method: paymentMethod,
    })
    .eq("id", id);

  if (totalsError) {
    return {
      success: false,
      error: "No se pudo preparar la factura. Intenta de nuevo.",
    };
  }

  const { data: issuedNumber, error: issueError } = await auth.supabase.rpc(
    "issue_invoice",
    {
      p_invoice_id: id,
      p_payment_method: paymentMethod,
      p_payment_instructions: paymentInstructions,
    },
  );

  if (issueError) {
    if (issueError.message.includes("customer is not active")) {
      return {
        success: false,
        error: "El cliente no está activo. Reactívalo antes de emitir.",
      };
    }

    if (issueError.message.includes("customer does not belong")) {
      return {
        success: false,
        error: "La factura no es válida. Vuelve a crearla.",
      };
    }

    if (issueError.message.includes("payment method is required")) {
      return {
        success: false,
        fieldErrors: { payment_method: "El método de pago es obligatorio al emitir." },
      };
    }

    return {
      success: false,
      error: "No se pudo emitir la factura. Intenta de nuevo.",
    };
  }

  if (issuedNumber === null || issuedNumber === undefined) {
    return {
      success: false,
      error: "No se pudo emitir la factura. Intenta de nuevo.",
    };
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  return { success: true };
}

export async function voidInvoice(formData: FormData): Promise<InvoiceActionResult> {
  const auth = await requireClient();
  if (!auth.valid) {
    return coerceInvoiceActionResult(auth.result);
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return { success: false, error: "El identificador de la factura es obligatorio." };
  }

  const { data: existing } = await auth.supabase
    .from("invoices")
    .select("id, workshop_id, status")
    .eq("id", id)
    .eq("workshop_id", auth.workshopId)
    .single();

  if (!existing) {
    return { success: false, error: "La factura no existe o no pertenece a tu taller." };
  }

  if (existing.status !== "issued") {
    return { success: false, error: "Solo las facturas emitidas se pueden anular." };
  }

  const { error } = await auth.supabase
    .from("invoices")
    .update({ status: "void", voided_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return {
      success: false,
      error: "No se pudo anular la factura. Intenta de nuevo.",
    };
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  return { success: true };
}

export async function deleteInvoice(
  formData: FormData,
): Promise<InvoiceActionResult> {
  const auth = await requireClient();
  if (!auth.valid) {
    return coerceInvoiceActionResult(auth.result);
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return { success: false, error: "El identificador de la factura es obligatorio." };
  }

  const { data: existing } = await auth.supabase
    .from("invoices")
    .select("id, workshop_id, status")
    .eq("id", id)
    .eq("workshop_id", auth.workshopId)
    .single();

  if (!existing) {
    return { success: false, error: "La factura no existe o no pertenece a tu taller." };
  }

  if (existing.status !== "draft") {
    return { success: false, error: "Solo los borradores se pueden eliminar." };
  }

  const { error } = await auth.supabase.from("invoices").delete().eq("id", id);

  if (error) {
    return {
      success: false,
      error: "No se pudo eliminar el borrador. Intenta de nuevo.",
    };
  }

  revalidatePath("/invoices");
  return { success: true };
}

export async function createCustomerFromInvoice(
  formData: FormData,
): Promise<CustomerFromInvoiceResult> {
  const auth = await requireClient();
  if (!auth.valid) {
    return auth.result as CustomerFromInvoiceResult;
  }

  const name = String(formData.get("name") ?? "").trim();
  const documentTypeIdRaw = formData.get("document_type_id");
  const documentNumberRaw = formData.get("document_number");
  const phoneRaw = formData.get("phone");
  const emailRaw = formData.get("email");
  const addressRaw = formData.get("address");

  const input = {
    name,
    documentTypeId:
      typeof documentTypeIdRaw === "string" && documentTypeIdRaw.trim().length > 0
        ? documentTypeIdRaw.trim()
        : null,
    documentNumber:
      typeof documentNumberRaw === "string" && documentNumberRaw.trim().length > 0
        ? documentNumberRaw.trim()
        : null,
    phone:
      typeof phoneRaw === "string" && phoneRaw.trim().length > 0
        ? phoneRaw.trim()
        : null,
    email:
      typeof emailRaw === "string" && emailRaw.trim().length > 0
        ? emailRaw.trim()
        : null,
    address:
      typeof addressRaw === "string" && addressRaw.trim().length > 0
        ? addressRaw.trim()
        : null,
    notes: null,
  };

  const validation = validateCustomerInput(input);

  if (!validation.valid) {
    return validation.result as CustomerFromInvoiceResult;
  }

  if (input.documentTypeId && input.documentNumber) {
    const { data: existingDocument } = await auth.supabase
      .from("customers")
      .select("id")
      .eq("workshop_id", auth.workshopId)
      .eq("document_type_id", input.documentTypeId)
      .eq("document_number", input.documentNumber)
      .maybeSingle();

    if (existingDocument) {
      return {
        success: false,
        fieldErrors: {
          document_number: "Ya existe un cliente con este documento en tu taller.",
        },
      };
    }
  }

  const { data, error } = await auth.supabase
    .from("customers")
    .insert({
      workshop_id: auth.workshopId,
      name: input.name,
      document_type_id: input.documentTypeId,
      document_number: input.documentNumber,
      phone: input.phone,
      email: input.email,
      address: input.address,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION_ERROR) {
      return {
        success: false,
        fieldErrors: {
          document_number: "Ya existe un cliente con este documento en tu taller.",
        },
      };
    }

    if (error.code === FOREIGN_KEY_VIOLATION_ERROR) {
      return {
        success: false,
        fieldErrors: {
          document_type_id: "El tipo de documento no es válido.",
        },
      };
    }

    return {
      success: false,
      error: "No se pudo crear el cliente. Intenta de nuevo.",
    };
  }

  revalidatePath("/customers");
  return { success: true, customerId: data?.id as string | undefined };
}
