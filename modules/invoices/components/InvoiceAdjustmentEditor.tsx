"use client";

import type { InvoiceAdjustmentInput } from "../types";

interface InvoiceAdjustmentEditorProps {
  adjustments: InvoiceAdjustmentInput[];
  onChange: (adjustments: InvoiceAdjustmentInput[]) => void;
}

const MAX_ADJUSTMENTS = 20;

const categoryOptions: Array<{ value: InvoiceAdjustmentInput["category"]; label: string }> =
  [
    { value: "tax", label: "Impuesto" },
    { value: "withholding", label: "Retención" },
    { value: "discount", label: "Descuento" },
    { value: "fee", label: "Cobro adicional" },
  ];

const modeOptions: Array<{ value: InvoiceAdjustmentInput["mode"]; label: string }> =
  [
    { value: "percentage", label: "Porcentaje" },
    { value: "fixed", label: "Valor fijo" },
  ];

function effectFromCategory(
  category: InvoiceAdjustmentInput["category"],
): "add" | "subtract" {
  return category === "tax" || category === "fee" ? "add" : "subtract";
}

function parseNumber(value: string): number {
  const normalized = value.replace(/,/g, "").trim();
  if (normalized === "") {
    return 0;
  }
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function InvoiceAdjustmentEditor({
  adjustments,
  onChange,
}: InvoiceAdjustmentEditorProps) {
  function addAdjustment() {
    if (adjustments.length >= MAX_ADJUSTMENTS) {
      return;
    }

    onChange([
      ...adjustments,
      {
        label: "",
        category: "tax",
        mode: "percentage",
        value: 0,
      },
    ]);
  }

  function removeAdjustment(index: number) {
    const updated = [...adjustments];
    updated.splice(index, 1);
    onChange(updated);
  }

  function updateAdjustment(
    index: number,
    updates: Partial<InvoiceAdjustmentInput>,
  ) {
    const updated = [...adjustments];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Ajustes
        </h3>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {adjustments.length} / {MAX_ADJUSTMENTS}
        </span>
      </div>

      {adjustments.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No hay ajustes. El total será igual al subtotal.
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
        {adjustments.map((adjustment, index) => {
          const effect = effectFromCategory(adjustment.category);

          return (
            <div
              key={index}
              className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex flex-col gap-2">
                <label
                  htmlFor={`adj_${index}_label`}
                  className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Etiqueta
                </label>
                <input
                  id={`adj_${index}_label`}
                  type="text"
                  value={adjustment.label}
                  onChange={(event) =>
                    updateAdjustment(index, { label: event.target.value })
                  }
                  placeholder="Ej. IVA"
                  className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor={`adj_${index}_category`}
                    className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Categoría
                  </label>
                  <select
                    id={`adj_${index}_category`}
                    value={adjustment.category}
                    onChange={(event) =>
                      updateAdjustment(index, {
                        category: event.target.value as InvoiceAdjustmentInput["category"],
                      })
                    }
                    className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
                  >
                    {categoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label
                    htmlFor={`adj_${index}_mode`}
                    className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Modo
                  </label>
                  <select
                    id={`adj_${index}_mode`}
                    value={adjustment.mode}
                    onChange={(event) =>
                      updateAdjustment(index, {
                        mode: event.target.value as InvoiceAdjustmentInput["mode"],
                      })
                    }
                    className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
                  >
                    {modeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor={`adj_${index}_value`}
                    className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Valor
                  </label>
                  <input
                    id={`adj_${index}_value`}
                    type="number"
                    min="0"
                    step={adjustment.mode === "percentage" ? "0.01" : "0.01"}
                    max={adjustment.mode === "percentage" ? "100" : undefined}
                    inputMode="decimal"
                    value={adjustment.value || ""}
                    onChange={(event) =>
                      updateAdjustment(index, {
                        value: parseNumber(event.target.value),
                      })
                    }
                    className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
                  />
                </div>

                <div className="flex items-end">
                  <p className="pb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Efecto:{" "}
                    <span
                      className={
                        effect === "add"
                          ? "text-green-700 dark:text-green-400"
                          : "text-red-700 dark:text-red-400"
                      }
                    >
                      {effect === "add" ? "Suma" : "Resta"}
                    </span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => removeAdjustment(index)}
                className="inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center self-start rounded-lg px-4 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950"
              >
                Eliminar
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addAdjustment}
        disabled={adjustments.length >= MAX_ADJUSTMENTS}
        className="inline-flex h-12 min-h-[44px] items-center justify-center rounded-lg border border-zinc-300 px-6 text-base font-medium text-zinc-900 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
      >
        Agregar ajuste
      </button>
    </div>
  );
}
