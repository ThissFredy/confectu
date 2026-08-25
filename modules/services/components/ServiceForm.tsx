"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { showToast } from "nextjs-toast-notify";
import type { Service, ServiceActionResult } from "../types";

interface ServiceFormProps {
  mode: "create" | "edit";
  service?: Service;
  action: (formData: FormData) => Promise<ServiceActionResult>;
  redirectHref?: string;
}

function SubmitButton({ mode }: { mode: "create" | "edit" }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-12 min-h-[44px] w-full items-center justify-center rounded-lg bg-zinc-900 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {pending ? "Guardando..." : mode === "create" ? "Crear servicio" : "Guardar cambios"}
    </button>
  );
}

function parsePriceInput(value: string): number {
  const normalized = value.replace(/,/g, "").trim();
  if (normalized === "") {
    return 0;
  }
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

function hasValidDecimals(value: number, maxDecimals: number): boolean {
  const multiplier = 10 ** maxDecimals;
  return Math.round(value * multiplier) === value * multiplier;
}

export function ServiceForm({
  mode,
  service,
  action,
  redirectHref = "/services",
}: ServiceFormProps) {
  const router = useRouter();
  const [result, setResult] = useState<ServiceActionResult | null>(null);

  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [category, setCategory] = useState(service?.category ?? "");
  const [priceInput, setPriceInput] = useState(
    service ? String(service.defaultPriceCop) : "",
  );

  async function handleAction() {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const trimmedCategory = category.trim();
    const priceValue = parsePriceInput(priceInput);

    const fieldErrors: Record<string, string> = {};

    if (trimmedName.length === 0) {
      fieldErrors.name = "El nombre es obligatorio.";
    } else if (trimmedName.length > 255) {
      fieldErrors.name = "El nombre debe tener máximo 255 caracteres.";
    }

    if (trimmedDescription.length > 1000) {
      fieldErrors.description = "La descripción debe tener máximo 1000 caracteres.";
    }

    if (trimmedCategory.length > 100) {
      fieldErrors.category = "La categoría debe tener máximo 100 caracteres.";
    }

    if (Number.isNaN(priceValue) || !Number.isFinite(priceValue)) {
      fieldErrors.default_price_cop = "El precio base no es válido.";
    } else if (priceValue < 0) {
      fieldErrors.default_price_cop = "El precio base no puede ser negativo.";
    } else if (priceValue > 9999999999.99) {
      fieldErrors.default_price_cop = "El precio base excede el máximo permitido.";
    } else if (!hasValidDecimals(priceValue, 2)) {
      fieldErrors.default_price_cop = "El precio base admite hasta 2 decimales.";
    }

    if (Object.keys(fieldErrors).length > 0) {
      setResult({ success: false, fieldErrors });
      return;
    }

    const formData = new FormData();

    if (mode === "edit" && service) {
      formData.set("id", service.id);
    }

    formData.set("name", trimmedName);
    formData.set("description", trimmedDescription);
    formData.set("category", trimmedCategory);
    formData.set("default_price_cop", String(priceValue));

    const response = await action(formData);
    setResult(response);

    if (response.success) {
      showToast.success(
        mode === "create" ? "Servicio creado" : "Servicio actualizado",
        { position: "top-right" },
      );
      router.push(redirectHref);
    } else if (response.error) {
      showToast.error(response.error, { position: "top-right" });
    }
  }

  const displayPrice = priceInput;

  return (
    <form action={handleAction} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label
          htmlFor="name"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Nombre
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={255}
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-describedby="name-help"
          aria-invalid={!!result?.fieldErrors?.name}
          className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
        />
        {result?.fieldErrors?.name ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {result.fieldErrors.name}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="category"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Categoría
        </label>
        <input
          id="category"
          name="category"
          type="text"
          maxLength={100}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="Ej. Pantalón, Camisa, Arreglo"
          aria-describedby="category-help"
          aria-invalid={!!result?.fieldErrors?.category}
          className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
        />
        {result?.fieldErrors?.category ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {result.fieldErrors.category}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="default_price_cop"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Precio base (COP)
        </label>
        <input
          id="default_price_cop"
          name="default_price_cop"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          required
          value={displayPrice}
          onChange={(event) => setPriceInput(event.target.value)}
          aria-describedby="price-help"
          aria-invalid={!!result?.fieldErrors?.default_price_cop}
          className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
        />
        {result?.fieldErrors?.default_price_cop ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {result.fieldErrors.default_price_cop}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="description"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Descripción
        </label>
        <textarea
          id="description"
          name="description"
          maxLength={1000}
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Detalles del servicio o prenda"
          aria-describedby="description-help"
          aria-invalid={!!result?.fieldErrors?.description}
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
        />
        {result?.fieldErrors?.description ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {result.fieldErrors.description}
          </p>
        ) : null}
      </div>

      {result?.error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {result.error}
        </p>
      ) : null}

      <SubmitButton mode={mode} />
    </form>
  );
}
