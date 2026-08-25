"use client";

import { useState, useTransition } from "react";
import { completeWorkshopSetup } from "../actions";
import type { AuthActionResult } from "../types";

interface OnboardingFormProps {
  onSuccess: () => void;
}

const INVOICE_PREFIX_REGEX = /^[A-Z0-9]{1,3}$/;

export function OnboardingForm({ onSuccess }: OnboardingFormProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AuthActionResult | null>(null);

  const handleAction = (formData: FormData) => {
    const businessName = String(formData.get("business_name") ?? "");
    const invoicePrefix = String(formData.get("invoice_prefix") ?? "").toUpperCase();

    const fieldErrors: Record<string, string> = {};
    const trimmedName = businessName.trim();

    if (trimmedName.length === 0) {
      fieldErrors.businessName = "El nombre comercial es obligatorio.";
    } else if (trimmedName.length > 255) {
      fieldErrors.businessName =
        "El nombre comercial debe tener máximo 255 caracteres.";
    }

    if (!INVOICE_PREFIX_REGEX.test(invoicePrefix)) {
      fieldErrors.invoicePrefix =
        "El prefijo debe tener 1 a 3 caracteres alfanuméricos en mayúscula.";
    }

    if (Object.keys(fieldErrors).length > 0) {
      setResult({ success: false, fieldErrors });
      return;
    }

    formData.set("business_name", trimmedName);
    formData.set("invoice_prefix", invoicePrefix);

    startTransition(async () => {
      const response = await completeWorkshopSetup(formData);
      setResult(response);
      if (response.success) {
        onSuccess();
      }
    });
  };

  return (
    <form action={handleAction} className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label
          htmlFor="business_name"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Nombre comercial
        </label>
        <input
          id="business_name"
          name="business_name"
          type="text"
          required
          maxLength={255}
          disabled={isPending}
          aria-describedby="business_name-help"
          aria-invalid={!!result?.fieldErrors?.businessName}
          className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
        />
        {result?.fieldErrors?.businessName ? (
          <p
            id="business_name-help"
            className="text-sm text-red-600 dark:text-red-400"
          >
            {result.fieldErrors.businessName}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="invoice_prefix"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Prefijo de factura
        </label>
        <input
          id="invoice_prefix"
          name="invoice_prefix"
          type="text"
          required
          maxLength={3}
          pattern="^[A-Z0-9]{1,3}$"
          disabled={isPending}
          aria-describedby="invoice_prefix-help"
          aria-invalid={!!result?.fieldErrors?.invoicePrefix}
          className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base uppercase text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
        />
        <p
          id="invoice_prefix-help"
          className="text-sm text-zinc-600 dark:text-zinc-400"
        >
          1-3 letras o números en mayúscula.
        </p>
        {result?.fieldErrors?.invoicePrefix ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {result.fieldErrors.invoicePrefix}
          </p>
        ) : null}
      </div>

      {result?.error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {result.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="flex h-12 min-h-[44px] w-full items-center justify-center rounded-lg bg-zinc-900 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? "Configurando..." : "Crear taller"}
      </button>
    </form>
  );
}
