"use client";

import { useMemo } from "react";
import type { InvoiceLineInput } from "../types";
import type { Service } from "@/modules/services/types";

interface InvoiceLineEditorProps {
  lines: InvoiceLineInput[];
  services: Service[];
  onChange: (lines: InvoiceLineInput[]) => void;
}

const MAX_LINES = 50;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function parseNumber(value: string): number {
  const normalized = value.replace(/,/g, "").trim();
  if (normalized === "") {
    return 0;
  }
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function InvoiceLineEditor({
  lines,
  services,
  onChange,
}: InvoiceLineEditorProps) {
  const servicesById = useMemo(() => {
    const map = new Map<string, Service>();
    services.forEach((service) => map.set(service.id, service));
    return map;
  }, [services]);

  function addLine() {
    if (lines.length >= MAX_LINES) {
      return;
    }

    onChange([
      ...lines,
      {
        serviceId: null,
        description: "",
        quantity: 1,
        unitPriceCop: 0,
      },
    ]);
  }

  function removeLine(index: number) {
    const updated = [...lines];
    updated.splice(index, 1);
    onChange(updated);
  }

  function updateLine(index: number, updates: Partial<InvoiceLineInput>) {
    const updated = [...lines];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  }

  function handleServiceChange(index: number, serviceId: string) {
    if (!serviceId) {
      updateLine(index, {
        serviceId: null,
        description: "",
        unitPriceCop: 0,
      });
      return;
    }

    const service = servicesById.get(serviceId);
    if (!service) {
      return;
    }

    updateLine(index, {
      serviceId: service.id,
      description: service.name,
      unitPriceCop: service.defaultPriceCop,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Líneas
        </h3>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {lines.length} / {MAX_LINES}
        </span>
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Agrega al menos una línea.
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
        {lines.map((line, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="flex flex-col gap-2">
              <label
                htmlFor={`line_${index}_service`}
                className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Servicio (opcional)
              </label>
              <select
                id={`line_${index}_service`}
                value={line.serviceId ?? ""}
                onChange={(event) =>
                  handleServiceChange(index, event.target.value)
                }
                className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
              >
                <option value="">Línea personalizada</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} — {formatCurrency(service.defaultPriceCop)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor={`line_${index}_description`}
                className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Descripción
              </label>
              <input
                id={`line_${index}_description`}
                type="text"
                value={line.description}
                onChange={(event) =>
                  updateLine(index, { description: event.target.value })
                }
                placeholder="Ej. Arreglo de pantalón"
                className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor={`line_${index}_quantity`}
                  className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Cantidad
                </label>
                <input
                  id={`line_${index}_quantity`}
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={line.quantity || ""}
                  onChange={(event) =>
                    updateLine(index, {
                      quantity: parseNumber(event.target.value),
                    })
                  }
                  className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor={`line_${index}_unit_price_cop`}
                  className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Precio unitario
                </label>
                <input
                  id={`line_${index}_unit_price_cop`}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={line.unitPriceCop || ""}
                  onChange={(event) =>
                    updateLine(index, {
                      unitPriceCop: parseNumber(event.target.value),
                    })
                  }
                  className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Total línea:{" "}
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(line.quantity * line.unitPriceCop)}
                </span>
              </p>
              <button
                type="button"
                onClick={() => removeLine(index)}
                className="inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-4 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addLine}
        disabled={lines.length >= MAX_LINES}
        className="inline-flex h-12 min-h-[44px] items-center justify-center rounded-lg border border-zinc-300 px-6 text-base font-medium text-zinc-900 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
      >
        Agregar línea
      </button>
    </div>
  );
}
