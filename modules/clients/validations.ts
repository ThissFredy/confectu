import type { CustomerActionResult, CustomerInput } from "./types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function validateCustomerInput(
  input: CustomerInput,
):
  | { valid: true }
  | { valid: false; result: CustomerActionResult } {
  const fieldErrors: Record<string, string> = {};

  const name = input.name.trim();

  if (name.length === 0) {
    fieldErrors.name = "El nombre es obligatorio.";
  } else if (name.length > 255) {
    fieldErrors.name = "El nombre debe tener máximo 255 caracteres.";
  }

  const documentTypeId = input.documentTypeId?.trim() ?? null;
  const documentNumber = input.documentNumber?.trim() ?? null;

  const hasDocumentType = Boolean(documentTypeId);
  const hasDocumentNumber = documentNumber !== null && documentNumber.length > 0;

  if (hasDocumentType !== hasDocumentNumber) {
    fieldErrors.document_number =
      "Debe indicar tipo y número de documento, o dejar ambos vacíos.";
  }

  if (hasDocumentNumber && documentNumber.length > 50) {
    fieldErrors.document_number =
      "El número de documento debe tener máximo 50 caracteres.";
  }

  const phone = input.phone?.trim() ?? null;
  if (phone !== null && phone.length > 50) {
    fieldErrors.phone = "El teléfono debe tener máximo 50 caracteres.";
  }

  const email = input.email?.trim() ?? null;
  if (email !== null) {
    if (email.length === 0) {
      // empty is treated as null
    } else if (email.length > 255) {
      fieldErrors.email = "El correo debe tener máximo 255 caracteres.";
    } else if (!isValidEmail(email)) {
      fieldErrors.email = "El correo no es válido.";
    }
  }

  const address = input.address?.trim() ?? null;
  if (address !== null && address.length > 500) {
    fieldErrors.address = "La dirección debe tener máximo 500 caracteres.";
  }

  const notes = input.notes?.trim() ?? null;
  if (notes !== null && notes.length > 1000) {
    fieldErrors.notes = "Las notas deben tener máximo 1000 caracteres.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false, result: { success: false, fieldErrors } };
  }

  return { valid: true };
}
