import type {
  InvoiceActionResult,
  InvoiceAdjustmentInput,
  InvoiceInput,
  InvoiceLineInput,
  InvoiceTotals,
} from "./types";

const MAX_DESCRIPTION_LENGTH = 500;
const MAX_ADJUSTMENT_LABEL_LENGTH = 100;
const MAX_PAYMENT_METHOD_LENGTH = 50;
const MAX_NOTES_LENGTH = 2000;
const MAX_LINE_UNIT_PRICE = 9999999999.99;
const MAX_LINE_QUANTITY = 9999999.99;
const MAX_LINES = 50;
const MIN_LINES = 1;
const MAX_ADJUSTMENTS = 20;

const VALID_CATEGORIES = ["tax", "withholding", "discount", "fee"] as const;
const VALID_MODES = ["percentage", "fixed"] as const;

function hasValidDecimals(value: number, maxDecimals: number): boolean {
  const multiplier = 10 ** maxDecimals;
  return Math.round(value * multiplier) === value * multiplier;
}

function parseDecimal(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const raw = String(value).replace(/,/g, "").trim();
  if (raw === "") {
    return null;
  }

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function validateLine(
  line: InvoiceLineInput,
  index: number,
  fieldErrors: Record<string, string>,
): void {
  const description = line.description.trim();

  if (description.length === 0) {
    fieldErrors[`line_${index}_description`] = "La descripción es obligatoria.";
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    fieldErrors[`line_${index}_description`] =
      `La descripción debe tener máximo ${MAX_DESCRIPTION_LENGTH} caracteres.`;
  }

  const quantity = line.quantity;
  if (Number.isNaN(quantity) || !Number.isFinite(quantity)) {
    fieldErrors[`line_${index}_quantity`] = "La cantidad no es válida.";
  } else if (quantity <= 0) {
    fieldErrors[`line_${index}_quantity`] = "La cantidad debe ser mayor a 0.";
  } else if (quantity > MAX_LINE_QUANTITY) {
    fieldErrors[`line_${index}_quantity`] = "La cantidad excede el máximo permitido.";
  } else if (!hasValidDecimals(quantity, 2)) {
    fieldErrors[`line_${index}_quantity`] = "La cantidad admite hasta 2 decimales.";
  }

  const unitPrice = line.unitPriceCop;
  if (Number.isNaN(unitPrice) || !Number.isFinite(unitPrice)) {
    fieldErrors[`line_${index}_unit_price_cop`] = "El precio no es válido.";
  } else if (unitPrice < 0) {
    fieldErrors[`line_${index}_unit_price_cop`] = "El precio no puede ser negativo.";
  } else if (unitPrice > MAX_LINE_UNIT_PRICE) {
    fieldErrors[`line_${index}_unit_price_cop`] =
      "El precio excede el máximo permitido.";
  } else if (!hasValidDecimals(unitPrice, 2)) {
    fieldErrors[`line_${index}_unit_price_cop`] =
      "El precio admite hasta 2 decimales.";
  }
}

function validateAdjustment(
  adjustment: InvoiceAdjustmentInput,
  index: number,
  fieldErrors: Record<string, string>,
): void {
  const label = adjustment.label.trim();

  if (label.length === 0) {
    fieldErrors[`adj_${index}_label`] = "La etiqueta es obligatoria.";
  } else if (label.length > MAX_ADJUSTMENT_LABEL_LENGTH) {
    fieldErrors[`adj_${index}_label`] =
      `La etiqueta debe tener máximo ${MAX_ADJUSTMENT_LABEL_LENGTH} caracteres.`;
  }

  if (!VALID_CATEGORIES.includes(adjustment.category)) {
    fieldErrors[`adj_${index}_category`] = "La categoría no es válida.";
  }

  if (!VALID_MODES.includes(adjustment.mode)) {
    fieldErrors[`adj_${index}_mode`] = "El modo no es válido.";
  }

  const value = adjustment.value;
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    fieldErrors[`adj_${index}_value`] = "El valor no es válido.";
  } else if (value < 0) {
    fieldErrors[`adj_${index}_value`] = "El valor no puede ser negativo.";
  } else if (adjustment.mode === "percentage" && value > 100) {
    fieldErrors[`adj_${index}_value`] = "El porcentaje no puede ser mayor a 100.";
  } else if (!hasValidDecimals(value, 2)) {
    fieldErrors[`adj_${index}_value`] = "El valor admite hasta 2 decimales.";
  }
}

export function validateInvoiceInput(
  input: InvoiceInput,
):
  | { valid: true }
  | { valid: false; result: InvoiceActionResult } {
  const fieldErrors: Record<string, string> = {};

  const customerId = input.customerId.trim();
  if (customerId.length === 0) {
    fieldErrors.customer_id = "El cliente es obligatorio.";
  }

  if (input.lines.length < MIN_LINES) {
    fieldErrors.lines = "Debe haber al menos una línea.";
  } else if (input.lines.length > MAX_LINES) {
    fieldErrors.lines = `Máximo ${MAX_LINES} líneas permitidas.`;
  } else {
    input.lines.forEach((line, index) => validateLine(line, index, fieldErrors));
  }

  if (input.adjustments.length > MAX_ADJUSTMENTS) {
    fieldErrors.adjustments = `Máximo ${MAX_ADJUSTMENTS} ajustes permitidos.`;
  } else {
    input.adjustments.forEach((adjustment, index) =>
      validateAdjustment(adjustment, index, fieldErrors),
    );
  }

  if (input.paymentMethod !== null) {
    const paymentMethod = input.paymentMethod.trim();
    if (paymentMethod.length > MAX_PAYMENT_METHOD_LENGTH) {
      fieldErrors.payment_method =
        `El método de pago debe tener máximo ${MAX_PAYMENT_METHOD_LENGTH} caracteres.`;
    }
  }

  if (input.paymentInstructions !== null) {
    const paymentInstructions = input.paymentInstructions.trim();
    if (paymentInstructions.length > 1000) {
      fieldErrors.payment_instructions =
        "Las instrucciones de pago deben tener máximo 1000 caracteres.";
    }
  }

  if (input.notes !== null) {
    const notes = input.notes.trim();
    if (notes.length > MAX_NOTES_LENGTH) {
      fieldErrors.notes = `Las notas deben tener máximo ${MAX_NOTES_LENGTH} caracteres.`;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false, result: { success: false, fieldErrors } };
  }

  return { valid: true };
}

function effectFromCategory(
  category: InvoiceAdjustmentInput["category"],
): "add" | "subtract" {
  return category === "tax" || category === "fee" ? "add" : "subtract";
}

export function calculateInvoiceTotals(
  lines: InvoiceLineInput[],
  adjustments: InvoiceAdjustmentInput[],
):
  | { valid: true; totals: InvoiceTotals }
  | { valid: false; error: string } {
  const subtotalCop = lines.reduce((sum, line) => {
    return sum + line.quantity * line.unitPriceCop;
  }, 0);

  let runningTotal = subtotalCop;
  let positiveAdjustments = 0;
  let negativeAdjustments = 0;

  const calculatedAdjustments = adjustments.map((adjustment, index) => {
    const baseCop =
      adjustment.mode === "percentage"
        ? index === 0
          ? subtotalCop
          : runningTotal
        : 0;

    const amountCop =
      adjustment.mode === "percentage"
        ? (baseCop * adjustment.value) / 100
        : adjustment.value;

    const effect = effectFromCategory(adjustment.category);

    if (effect === "add") {
      runningTotal += amountCop;
      positiveAdjustments += amountCop;
    } else {
      runningTotal -= amountCop;
      negativeAdjustments += amountCop;
    }

    return {
      id: `temp-${index}`,
      baseCop,
      amountCop,
      effect,
    };
  });

  const totalCop = runningTotal;
  const totalAdjustmentsCop = positiveAdjustments - negativeAdjustments;

  if (totalCop < 0) {
    return { valid: false, error: "El total no puede ser negativo." };
  }

  return {
    valid: true,
    totals: {
      subtotalCop,
      totalAdjustmentsCop,
      totalCop,
      adjustments: calculatedAdjustments,
    },
  };
}

export { parseDecimal };
