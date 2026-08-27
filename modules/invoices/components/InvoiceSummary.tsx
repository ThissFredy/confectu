"use client";

import { useMemo } from "react";
import type {
  InvoiceAdjustmentInput,
  InvoiceLineInput,
} from "../types";

interface InvoiceSummaryProps {
  lines: InvoiceLineInput[];
  adjustments: InvoiceAdjustmentInput[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function effectFromCategory(
  category: InvoiceAdjustmentInput["category"],
): "add" | "subtract" {
  return category === "tax" || category === "fee" ? "add" : "subtract";
}

export function InvoiceSummary({ lines, adjustments }: InvoiceSummaryProps) {
  const summary = useMemo(() => {
    const subtotalCop = lines.reduce(
      (sum, line) => sum + line.quantity * line.unitPriceCop,
      0,
    );

    const { runningTotal, positiveAdjustments, negativeAdjustments, adjustmentDetails } =
      adjustments.reduce(
        (acc, adjustment, index) => {
          const baseCop =
            adjustment.mode === "percentage"
              ? index === 0
                ? subtotalCop
                : acc.runningTotal
              : 0;

          const amountCop =
            adjustment.mode === "percentage"
              ? (baseCop * adjustment.value) / 100
              : adjustment.value;

          const effect = effectFromCategory(adjustment.category);

          return {
            runningTotal:
              effect === "add"
                ? acc.runningTotal + amountCop
                : acc.runningTotal - amountCop,
            positiveAdjustments:
              effect === "add"
                ? acc.positiveAdjustments + amountCop
                : acc.positiveAdjustments,
            negativeAdjustments:
              effect === "subtract"
                ? acc.negativeAdjustments + amountCop
                : acc.negativeAdjustments,
            adjustmentDetails: [
              ...acc.adjustmentDetails,
              {
                label: adjustment.label,
                amountCop,
                effect,
              },
            ],
          };
        },
        {
          runningTotal: subtotalCop,
          positiveAdjustments: 0,
          negativeAdjustments: 0,
          adjustmentDetails: [] as Array<{
            label: string;
            amountCop: number;
            effect: "add" | "subtract";
          }>,
        },
      );

    const totalCop = runningTotal;
    const totalAdjustmentsCop = positiveAdjustments - negativeAdjustments;

    return {
      subtotalCop,
      totalAdjustmentsCop,
      totalCop,
      adjustmentDetails,
    };
  }, [lines, adjustments]);

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        Resumen
      </h3>

      <div className="mt-4 flex flex-col gap-2">
        <div className="flex items-center justify-between text-base text-zinc-700 dark:text-zinc-300">
          <span>Subtotal</span>
          <span>{formatCurrency(summary.subtotalCop)}</span>
        </div>

        {summary.adjustmentDetails.map((adjustment, index) => (
          <div
            key={`${adjustment.label}-${index}`}
            className="flex items-center justify-between text-base text-zinc-700 dark:text-zinc-300"
          >
            <span>{adjustment.label}</span>
            <span
              className={
                adjustment.effect === "add"
                  ? "text-zinc-700 dark:text-zinc-300"
                  : "text-red-600 dark:text-red-400"
              }
            >
              {adjustment.effect === "add" ? "+" : "−"}{" "}
              {formatCurrency(adjustment.amountCop)}
            </span>
          </div>
        ))}

        <div className="flex items-center justify-between border-t border-zinc-200 pt-2 text-base font-medium text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
          <span>Total ajustes</span>
          <span>{formatCurrency(summary.totalAdjustmentsCop)}</span>
        </div>

        <div className="flex items-center justify-between border-t border-zinc-200 pt-2 text-lg font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
          <span>Total</span>
          <span>{formatCurrency(summary.totalCop)}</span>
        </div>
      </div>

      {summary.totalCop < 0 ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          El total no puede ser negativo.
        </p>
      ) : null}
    </div>
  );
}
