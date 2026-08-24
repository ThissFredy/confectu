import type { ServiceActionResult, ServiceInput } from "./types";

const MAX_PRICE = 9999999999.99;

export function validateServiceInput(
  input: ServiceInput,
):
  | { valid: true }
  | { valid: false; result: ServiceActionResult } {
  const fieldErrors: Record<string, string> = {};

  const name = input.name.trim();

  if (name.length === 0) {
    fieldErrors.name = "El nombre es obligatorio.";
  } else if (name.length > 255) {
    fieldErrors.name = "El nombre debe tener máximo 255 caracteres.";
  }

  const description = input.description?.trim() ?? null;
  if (description !== null && description.length > 1000) {
    fieldErrors.description = "La descripción debe tener máximo 1000 caracteres.";
  }

  const category = input.category?.trim() ?? null;
  if (category !== null && category.length > 100) {
    fieldErrors.category = "La categoría debe tener máximo 100 caracteres.";
  }

  if (Number.isNaN(input.defaultPriceCop)) {
    fieldErrors.default_price_cop = "El precio base no es válido.";
  } else if (!Number.isFinite(input.defaultPriceCop)) {
    fieldErrors.default_price_cop = "El precio base no es válido.";
  } else if (input.defaultPriceCop < 0) {
    fieldErrors.default_price_cop = "El precio base no puede ser negativo.";
  } else if (input.defaultPriceCop > MAX_PRICE) {
    fieldErrors.default_price_cop = "El precio base excede el máximo permitido.";
  } else if (!hasValidDecimals(input.defaultPriceCop, 2)) {
    fieldErrors.default_price_cop = "El precio base admite hasta 2 decimales.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false, result: { success: false, fieldErrors } };
  }

  return { valid: true };
}

function hasValidDecimals(value: number, maxDecimals: number): boolean {
  const multiplier = 10 ** maxDecimals;
  return Math.round(value * multiplier) === value * multiplier;
}
