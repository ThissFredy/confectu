"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { showToast } from "nextjs-toast-notify";
import type { Customer } from "@/modules/clients/types";
import type { Service } from "@/modules/services/types";
import { CustomerPicker } from "./CustomerPicker";
import { InvoiceLineEditor } from "./InvoiceLineEditor";
import { InvoiceAdjustmentEditor } from "./InvoiceAdjustmentEditor";
import { InvoiceSummary } from "./InvoiceSummary";
import { InvoiceIssueButton } from "./InvoiceIssueButton";
import { InvoiceDeleteButton } from "./InvoiceDeleteButton";
import type { InvoiceActionResult, InvoiceWithRelations } from "../types";

interface InvoiceFormProps {
  mode: "create" | "edit";
  invoice?: InvoiceWithRelations;
  services: Service[];
  customers: Customer[];
  action: (formData: FormData) => Promise<InvoiceActionResult>;
  issueAction?: (formData: FormData) => Promise<InvoiceActionResult>;
  deleteAction?: (formData: FormData) => Promise<InvoiceActionResult>;
}

function SubmitButton({ mode }: { mode: "create" | "edit" }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-12 min-h-[44px] w-full items-center justify-center rounded-lg bg-zinc-900 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {pending
        ? "Guardando..."
        : mode === "create"
          ? "Guardar borrador"
          : "Guardar cambios"}
    </button>
  );
}

export function InvoiceForm({
  mode,
  invoice,
  services,
  customers,
  action,
  issueAction,
  deleteAction,
}: InvoiceFormProps) {
  const router = useRouter();
  const [result, setResult] = useState<InvoiceActionResult | null>(null);

  const [customerId, setCustomerId] = useState<string | null>(
    invoice?.customer.id ?? null,
  );

  const [lines, setLines] = useState(
    invoice?.lines.map((line) => ({
      serviceId: line.serviceId,
      description: line.descriptionSnapshot,
      quantity: line.quantity,
      unitPriceCop: line.unitPriceCop,
    })) ?? [
      {
        serviceId: null as string | null,
        description: "",
        quantity: 1,
        unitPriceCop: 0,
      },
    ],
  );

  const [adjustments, setAdjustments] = useState(
    invoice?.adjustments.map((adjustment) => ({
      label: adjustment.label,
      category: adjustment.category,
      mode: adjustment.mode,
      value: adjustment.value,
    })) ?? [],
  );

  const [paymentMethod, setPaymentMethod] = useState(
    invoice?.invoice.paymentMethod ?? "",
  );
  const [paymentInstructions, setPaymentInstructions] = useState(
    invoice?.invoice.paymentInstructions ?? "",
  );
  const [notes, setNotes] = useState(invoice?.invoice.notes ?? "");

  async function handleAction() {
    const fieldErrors: Record<string, string> = {};

    if (!customerId) {
      fieldErrors.customer_id = "El cliente es obligatorio.";
    }

    if (lines.length === 0) {
      fieldErrors.lines = "Debe haber al menos una línea.";
    }

    lines.forEach((line, index) => {
      if (line.description.trim().length === 0) {
        fieldErrors[`line_${index}_description`] = "La descripción es obligatoria.";
      }

      if (line.quantity <= 0) {
        fieldErrors[`line_${index}_quantity`] = "La cantidad debe ser mayor a 0.";
      }

      if (line.unitPriceCop < 0) {
        fieldErrors[`line_${index}_unit_price_cop`] =
          "El precio no puede ser negativo.";
      }
    });

    adjustments.forEach((adjustment, index) => {
      if (adjustment.label.trim().length === 0) {
        fieldErrors[`adj_${index}_label`] = "La etiqueta es obligatoria.";
      }

      if (adjustment.value < 0) {
        fieldErrors[`adj_${index}_value`] = "El valor no puede ser negativo.";
      }

      if (adjustment.mode === "percentage" && adjustment.value > 100) {
        fieldErrors[`adj_${index}_value`] = "El porcentaje no puede ser mayor a 100.";
      }
    });

    if (Object.keys(fieldErrors).length > 0) {
      setResult({ success: false, fieldErrors });
      showToast.error("Revisa los campos marcados e inténtalo de nuevo.", {
        position: "top-right",
      });
      return;
    }

    const formData = new FormData();

    if (mode === "edit" && invoice) {
      formData.set("id", invoice.invoice.id);
    }

    formData.set("customer_id", customerId ?? "");
    formData.set("line_count", String(lines.length));

    lines.forEach((line, index) => {
      if (line.serviceId) {
        formData.set(`line_${index}_service_id`, line.serviceId);
      }
      formData.set(`line_${index}_description`, line.description);
      formData.set(`line_${index}_quantity`, String(line.quantity));
      formData.set(`line_${index}_unit_price_cop`, String(line.unitPriceCop));
    });

    formData.set("adj_count", String(adjustments.length));

    adjustments.forEach((adjustment, index) => {
      formData.set(`adj_${index}_label`, adjustment.label);
      formData.set(`adj_${index}_category`, adjustment.category);
      formData.set(`adj_${index}_mode`, adjustment.mode);
      formData.set(`adj_${index}_value`, String(adjustment.value));
    });

    formData.set("payment_method", paymentMethod.trim());
    formData.set("payment_instructions", paymentInstructions.trim());
    formData.set("notes", notes.trim());

    const response = await action(formData);
    setResult(response);

    if (response.success) {
      showToast.success(
        mode === "create" ? "Borrador creado" : "Borrador actualizado",
        { position: "top-right" },
      );

      if (mode === "create" && response.invoiceId) {
        router.push(`/invoices/${response.invoiceId}`);
      } else {
        router.refresh();
      }
    } else if (response.fieldErrors && Object.keys(response.fieldErrors).length > 0) {
      showToast.error("Revisa los campos marcados e inténtalo de nuevo.", {
        position: "top-right",
      });
    } else if (response.error) {
      showToast.error(response.error, { position: "top-right" });
    }
  }

  return (
    <form action={handleAction} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Cliente
        </label>
        <CustomerPicker
          selectedCustomerId={customerId}
          onSelect={setCustomerId}
          customers={customers}
        />
        {result?.fieldErrors?.customer_id ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {result.fieldErrors.customer_id}
          </p>
        ) : null}
      </div>

      <InvoiceLineEditor lines={lines} services={services} onChange={setLines} />
      {result?.fieldErrors?.lines ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          {result.fieldErrors.lines}
        </p>
      ) : null}

      <InvoiceAdjustmentEditor
        adjustments={adjustments}
        onChange={setAdjustments}
      />

      <InvoiceSummary lines={lines} adjustments={adjustments} />

      <div className="flex flex-col gap-2">
        <label
          htmlFor="payment_method"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Método de pago
        </label>
        <select
          id="payment_method"
          name="payment_method"
          value={paymentMethod}
          onChange={(event) => setPaymentMethod(event.target.value)}
          className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
        >
          <option value="">Seleccionar...</option>
          <option value="Efectivo">Efectivo</option>
          <option value="Transferencia">Transferencia</option>
          <option value="Tarjeta">Tarjeta</option>
        </select>
        {result?.fieldErrors?.payment_method ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {result.fieldErrors.payment_method}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="payment_instructions"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Instrucciones de pago
        </label>
        <textarea
          id="payment_instructions"
          name="payment_instructions"
          rows={3}
          maxLength={1000}
          value={paymentInstructions}
          onChange={(event) => setPaymentInstructions(event.target.value)}
          placeholder="Datos para que el cliente realice el pago"
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
        />
        {result?.fieldErrors?.payment_instructions ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {result.fieldErrors.payment_instructions}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="notes"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Notas internas
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={2000}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Notas internas del taller (no aparecen en el PDF)"
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
        />
        {result?.fieldErrors?.notes ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {result.fieldErrors.notes}
          </p>
        ) : null}
      </div>

      {result?.error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {result.error}
        </p>
      ) : null}

      <SubmitButton mode={mode} />

      {mode === "edit" && invoice && issueAction ? (
        <InvoiceIssueButton
          invoiceId={invoice.invoice.id}
          paymentMethod={paymentMethod}
          paymentInstructions={paymentInstructions}
          action={issueAction}
        />
      ) : null}

      {mode === "edit" && invoice && deleteAction ? (
        <div className="flex justify-end">
          <InvoiceDeleteButton
            invoiceId={invoice.invoice.id}
            action={deleteAction}
          />
        </div>
      ) : null}
    </form>
  );
}
