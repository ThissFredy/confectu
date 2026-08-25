"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { showToast } from "nextjs-toast-notify";
import type { WorkshopActionResult, WorkshopWithSettings } from "../types";

interface WorkshopSettingsFormProps {
  workshop: WorkshopWithSettings;
  logoUrl: string | null;
  currentLogoPath: string | null;
  action: (formData: FormData) => Promise<WorkshopActionResult>;
  showNextInvoiceNumber?: boolean;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVOICE_PREFIX_REGEX = /^[A-Z0-9]{1,3}$/;
const LOGO_MAX_SIZE = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-12 min-h-[44px] w-full items-center justify-center rounded-lg bg-zinc-900 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {pending ? "Guardando..." : "Guardar cambios"}
    </button>
  );
}

export function WorkshopSettingsForm({
  workshop,
  logoUrl,
  currentLogoPath,
  action,
  showNextInvoiceNumber = false,
}: WorkshopSettingsFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<WorkshopActionResult | null>(null);
  const [prefix, setPrefix] = useState(workshop.settings?.invoicePrefix ?? "");
  const [selectedLogo, setSelectedLogo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(logoUrl);
  const [removeLogo, setRemoveLogo] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl !== logoUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, logoUrl]);

  function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      showToast.error("El logo debe ser una imagen PNG, JPEG o WebP.", {
        position: "top-right",
      });
      event.target.value = "";
      return;
    }

    if (file.size > LOGO_MAX_SIZE) {
      showToast.error("El logo no puede superar 2 MB.", {
        position: "top-right",
      });
      event.target.value = "";
      return;
    }

    setSelectedLogo(file);
    setRemoveLogo(false);

    if (previewUrl && previewUrl !== logoUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleRemoveLogoCheck(checked: boolean) {
    setRemoveLogo(checked);
    if (checked) {
      setSelectedLogo(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (previewUrl && previewUrl !== logoUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
    } else {
      setPreviewUrl(logoUrl);
    }
  }

  async function handleAction(formData: FormData) {
    const businessName = String(formData.get("business_name") ?? "").trim();
    const taxId = String(formData.get("tax_id") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const address = String(formData.get("address") ?? "").trim();
    const invoicePrefix = String(formData.get("invoice_prefix") ?? "")
      .trim()
      .toUpperCase();
    const paymentInstructions = String(
      formData.get("payment_instructions") ?? "",
    ).trim();
    const wantsRemoveLogo = formData.get("remove_logo") === "true";

    const fieldErrors: Record<string, string> = {};

    if (businessName.length === 0) {
      fieldErrors.business_name = "El nombre comercial es obligatorio.";
    } else if (businessName.length > 255) {
      fieldErrors.business_name =
        "El nombre comercial debe tener máximo 255 caracteres.";
    }

    if (taxId.length > 50) {
      fieldErrors.tax_id =
        "La identificación fiscal debe tener máximo 50 caracteres.";
    }

    if (phone.length > 50) {
      fieldErrors.phone = "El teléfono debe tener máximo 50 caracteres.";
    }

    if (email.length > 0) {
      if (email.length > 255) {
        fieldErrors.email = "El correo debe tener máximo 255 caracteres.";
      } else if (!EMAIL_REGEX.test(email)) {
        fieldErrors.email = "El correo no es válido.";
      }
    }

    if (address.length > 500) {
      fieldErrors.address = "La dirección debe tener máximo 500 caracteres.";
    }

    if (invoicePrefix.length === 0) {
      fieldErrors.invoice_prefix = "El prefijo es obligatorio.";
    } else if (!INVOICE_PREFIX_REGEX.test(invoicePrefix)) {
      fieldErrors.invoice_prefix =
        "El prefijo debe tener 1 a 3 letras o números en mayúscula.";
    }

    if (paymentInstructions.length > 1000) {
      fieldErrors.payment_instructions =
        "Las instrucciones de pago deben tener máximo 1000 caracteres.";
    }

    if (showNextInvoiceNumber) {
      const nextInvoiceNumber = Number(formData.get("next_invoice_number") ?? "");
      if (!Number.isFinite(nextInvoiceNumber) || nextInvoiceNumber < 1) {
        fieldErrors.next_invoice_number =
          "El número de factura debe ser mayor o igual a 1.";
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      setResult({ success: false, fieldErrors });
      return;
    }

    formData.set("business_name", businessName);
    formData.set("tax_id", taxId);
    formData.set("phone", phone);
    formData.set("email", email);
    formData.set("address", address);
    formData.set("invoice_prefix", invoicePrefix);
    formData.set("payment_instructions", paymentInstructions);

    if (selectedLogo) {
      formData.set("logo", selectedLogo);
    } else if (wantsRemoveLogo) {
      formData.set("remove_logo", "true");
    }

    const response = await action(formData);
    setResult(response);

    if (response.success) {
      showToast.success("Configuración del taller actualizada", {
        position: "top-right",
      });
      router.refresh();
    } else if (response.error) {
      showToast.error(response.error, { position: "top-right" });
    }
  }

  const showPreview = previewUrl !== null;

  return (
    <form action={handleAction} className="flex flex-col gap-6">
      <input type="hidden" name="workshop_id" value={workshop.workshop.id} />

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
          defaultValue={workshop.settings?.businessName}
          aria-invalid={!!result?.fieldErrors?.business_name}
          className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
        />
        {result?.fieldErrors?.business_name ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {result.fieldErrors.business_name}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="tax_id"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Identificación fiscal
        </label>
        <input
          id="tax_id"
          name="tax_id"
          type="text"
          maxLength={50}
          defaultValue={workshop.settings?.taxId ?? ""}
          aria-invalid={!!result?.fieldErrors?.tax_id}
          className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
        />
        {result?.fieldErrors?.tax_id ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {result.fieldErrors.tax_id}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="phone"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Teléfono
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          maxLength={50}
          defaultValue={workshop.settings?.phone ?? ""}
          aria-invalid={!!result?.fieldErrors?.phone}
          className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
        />
        {result?.fieldErrors?.phone ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {result.fieldErrors.phone}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="email"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          maxLength={255}
          defaultValue={workshop.settings?.email ?? ""}
          aria-invalid={!!result?.fieldErrors?.email}
          className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
        />
        {result?.fieldErrors?.email ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {result.fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="address"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Dirección
        </label>
        <input
          id="address"
          name="address"
          type="text"
          maxLength={500}
          defaultValue={workshop.settings?.address ?? ""}
          aria-invalid={!!result?.fieldErrors?.address}
          className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
        />
        {result?.fieldErrors?.address ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {result.fieldErrors.address}
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
          pattern="^[A-Z0-9]{1,3}$"
          maxLength={3}
          value={prefix}
          onChange={(event) => {
            setPrefix(event.target.value.toUpperCase());
          }}
          aria-describedby="invoice-prefix-help"
          aria-invalid={!!result?.fieldErrors?.invoice_prefix}
          className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base uppercase text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
        />
        <p
          id="invoice-prefix-help"
          className="text-sm text-zinc-600 dark:text-zinc-400"
        >
          1 a 3 letras o números en mayúscula.
        </p>
        {result?.fieldErrors?.invoice_prefix ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {result.fieldErrors.invoice_prefix}
          </p>
        ) : null}
      </div>

      {showNextInvoiceNumber ? (
        <div className="flex flex-col gap-2">
          <label
            htmlFor="next_invoice_number"
            className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Siguiente número de factura
          </label>
          <input
            id="next_invoice_number"
            name="next_invoice_number"
            type="number"
            required
            min={1}
            defaultValue={workshop.settings?.nextInvoiceNumber}
            aria-invalid={!!result?.fieldErrors?.next_invoice_number}
            className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
          />
          {result?.fieldErrors?.next_invoice_number ? (
            <p className="text-sm text-red-600 dark:text-red-400">
              {result.fieldErrors.next_invoice_number}
            </p>
          ) : null}
        </div>
      ) : null}

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
          maxLength={1000}
          rows={4}
          defaultValue={workshop.settings?.paymentInstructions ?? ""}
          aria-invalid={!!result?.fieldErrors?.payment_instructions}
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
        />
        {result?.fieldErrors?.payment_instructions ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {result.fieldErrors.payment_instructions}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <label
          htmlFor="logo"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Logo del taller
        </label>

        {showPreview ? (
          <div className="flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Vista previa del logo"
              className="max-h-40 rounded-lg object-contain"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              Sin logo
            </span>
          </div>
        )}

        <input
          ref={fileInputRef}
          id="logo"
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleLogoChange}
          className="block w-full text-sm text-zinc-700 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-4 file:py-3 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-800 dark:text-zinc-300 dark:file:bg-zinc-100 dark:file:text-zinc-900 dark:hover:file:bg-zinc-200"
        />

        {currentLogoPath ? (
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              name="remove_logo"
              checked={removeLogo}
              onChange={(event) => handleRemoveLogoCheck(event.target.checked)}
              className="h-5 w-5 accent-zinc-900 dark:accent-zinc-100"
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              Eliminar logo actual
            </span>
          </label>
        ) : null}
      </div>

      {result?.error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {result.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
