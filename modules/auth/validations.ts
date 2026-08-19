import type { AuthActionResult, WorkshopSetupInput } from "./types";

const INVOICE_PREFIX_REGEX = /^[A-Z0-9]{1,3}$/;

export function validateWorkshopSetup(
  input: WorkshopSetupInput,
):
  | { valid: true }
  | { valid: false; result: AuthActionResult } {
  const fieldErrors: Record<string, string> = {};
  const businessName = input.businessName.trim();

  if (businessName.length === 0) {
    fieldErrors.businessName = "El nombre comercial es obligatorio.";
  } else if (businessName.length > 255) {
    fieldErrors.businessName =
      "El nombre comercial debe tener máximo 255 caracteres.";
  }

  if (!INVOICE_PREFIX_REGEX.test(input.invoicePrefix)) {
    fieldErrors.invoicePrefix =
      "El prefijo debe tener 1 a 3 caracteres alfanuméricos en mayúscula.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false, result: { success: false, fieldErrors } };
  }

  return { valid: true };
}

export function isInternalRoute(next: string): boolean {
  return (
    next.startsWith("/") && !next.startsWith("//") && !next.includes("://")
  );
}
