import type { DocumentTypeActionResult, DocumentTypeInput } from "./types";

const CODE_REGEX = /^[A-Z]{1,5}$/;

export function validateDocumentTypeInput(
  input: DocumentTypeInput,
):
  | { valid: true }
  | { valid: false; result: DocumentTypeActionResult } {
  const fieldErrors: Record<string, string> = {};
  const code = input.code.trim().toUpperCase();

  if (code.length === 0) {
    fieldErrors.code = "El código es obligatorio.";
  } else if (!CODE_REGEX.test(code)) {
    fieldErrors.code = "El código debe tener 1 a 5 letras en mayúscula.";
  }

  const name = input.name.trim();

  if (name.length === 0) {
    fieldErrors.name = "El nombre es obligatorio.";
  } else if (name.length > 255) {
    fieldErrors.name = "El nombre debe tener máximo 255 caracteres.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false, result: { success: false, fieldErrors } };
  }

  return { valid: true };
}
