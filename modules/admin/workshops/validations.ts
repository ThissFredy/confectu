import { isValidEmail } from "@/modules/clients/validations";
import type { WorkshopActionResult } from "./types";

const INVOICE_PREFIX_REGEX = /^[A-Z0-9]{1,3}$/;

export interface WorkshopSettingsInput {
  businessName: string;
  taxId: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  paymentInstructions: string | null;
}

export function validateWorkshopSettingsInput(
  input: WorkshopSettingsInput,
  currentNextInvoiceNumber: number,
):
  | { valid: true }
  | { valid: false; result: WorkshopActionResult } {
  const fieldErrors: Record<string, string> = {};

  const businessName = input.businessName.trim();

  if (businessName.length === 0) {
    fieldErrors.business_name = "El nombre comercial es obligatorio.";
  } else if (businessName.length > 255) {
    fieldErrors.business_name =
      "El nombre comercial debe tener máximo 255 caracteres.";
  }

  const taxId = input.taxId?.trim() ?? null;
  if (taxId !== null && taxId.length > 50) {
    fieldErrors.tax_id = "La identificación fiscal debe tener máximo 50 caracteres.";
  }

  const phone = input.phone?.trim() ?? null;
  if (phone !== null && phone.length > 50) {
    fieldErrors.phone = "El teléfono debe tener máximo 50 caracteres.";
  }

  const email = input.email?.trim() ?? null;
  if (email !== null && email.length > 0) {
    if (email.length > 255) {
      fieldErrors.email = "El correo debe tener máximo 255 caracteres.";
    } else if (!isValidEmail(email)) {
      fieldErrors.email = "El correo no es válido.";
    }
  }

  const address = input.address?.trim() ?? null;
  if (address !== null && address.length > 500) {
    fieldErrors.address = "La dirección debe tener máximo 500 caracteres.";
  }

  const invoicePrefix = input.invoicePrefix.trim().toUpperCase();
  if (invoicePrefix.length === 0) {
    fieldErrors.invoice_prefix = "El prefijo es obligatorio.";
  } else if (!INVOICE_PREFIX_REGEX.test(invoicePrefix)) {
    fieldErrors.invoice_prefix =
      "El prefijo debe tener 1 a 3 letras o números en mayúscula.";
  }

  if (!Number.isFinite(input.nextInvoiceNumber) || input.nextInvoiceNumber < 1) {
    fieldErrors.next_invoice_number =
      "El número de factura debe ser mayor o igual a 1.";
  } else if (input.nextInvoiceNumber < currentNextInvoiceNumber) {
    fieldErrors.next_invoice_number =
      "El número de factura no puede disminuir.";
  }

  const paymentInstructions = input.paymentInstructions?.trim() ?? null;
  if (paymentInstructions !== null && paymentInstructions.length > 1000) {
    fieldErrors.payment_instructions =
      "Las instrucciones de pago deben tener máximo 1000 caracteres.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false, result: { success: false, fieldErrors } };
  }

  return { valid: true };
}
