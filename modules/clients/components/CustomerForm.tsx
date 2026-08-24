"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { showToast } from "nextjs-toast-notify";
import type { DocumentType } from "@/modules/admin/document-types/types";
import type { Customer, CustomerActionResult } from "../types";

interface CustomerFormProps {
  mode: "create" | "edit";
  customer?: Customer;
  documentTypes: DocumentType[];
  action: (formData: FormData) => Promise<CustomerActionResult>;
  redirectHref?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function SubmitButton({ mode }: { mode: "create" | "edit" }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-12 min-h-[44px] w-full items-center justify-center rounded-lg bg-zinc-900 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {pending ? "Guardando..." : mode === "create" ? "Crear cliente" : "Guardar cambios"}
    </button>
  );
}

export function CustomerForm({
  mode,
  customer,
  documentTypes,
  action,
  redirectHref = "/customers",
}: CustomerFormProps) {
  const router = useRouter();
  const [result, setResult] = useState<CustomerActionResult | null>(null);

  const [name, setName] = useState(customer?.name ?? "");
  const [selectedDocumentTypeId, setSelectedDocumentTypeId] = useState(
    customer?.documentTypeId ?? "",
  );
  const [documentNumber, setDocumentNumber] = useState(
    customer?.documentNumber ?? "",
  );
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [address, setAddress] = useState(customer?.address ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");

  const currentDocumentTypeInactive = customer?.documentTypeId
    ? !documentTypes.some((type) => type.id === customer.documentTypeId)
    : false;

  async function handleAction() {
    const trimmedName = name.trim();
    const trimmedDocumentTypeId = selectedDocumentTypeId.trim();
    const trimmedDocumentNumber = documentNumber.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();
    const trimmedAddress = address.trim();
    const trimmedNotes = notes.trim();

    const fieldErrors: Record<string, string> = {};

    if (trimmedName.length === 0) {
      fieldErrors.name = "El nombre es obligatorio.";
    } else if (trimmedName.length > 255) {
      fieldErrors.name = "El nombre debe tener máximo 255 caracteres.";
    }

    const hasDocumentType = trimmedDocumentTypeId.length > 0;
    const hasDocumentNumber = trimmedDocumentNumber.length > 0;

    if (hasDocumentType !== hasDocumentNumber) {
      fieldErrors.document_number =
        "Debe indicar tipo y número de documento, o dejar ambos vacíos.";
    }

    if (hasDocumentNumber && trimmedDocumentNumber.length > 50) {
      fieldErrors.document_number =
        "El número de documento debe tener máximo 50 caracteres.";
    }

    if (trimmedPhone.length > 50) {
      fieldErrors.phone = "El teléfono debe tener máximo 50 caracteres.";
    }

    if (trimmedEmail.length > 0) {
      if (trimmedEmail.length > 255) {
        fieldErrors.email = "El correo debe tener máximo 255 caracteres.";
      } else if (!EMAIL_REGEX.test(trimmedEmail)) {
        fieldErrors.email = "El correo no es válido.";
      }
    }

    if (trimmedAddress.length > 500) {
      fieldErrors.address = "La dirección debe tener máximo 500 caracteres.";
    }

    if (trimmedNotes.length > 1000) {
      fieldErrors.notes = "Las notas deben tener máximo 1000 caracteres.";
    }

    if (Object.keys(fieldErrors).length > 0) {
      setResult({ success: false, fieldErrors });
      return;
    }

    const formData = new FormData();

    if (mode === "edit" && customer) {
      formData.set("id", customer.id);
    }

    formData.set("name", trimmedName);
    formData.set("document_type_id", trimmedDocumentTypeId);
    formData.set("document_number", trimmedDocumentNumber);
    formData.set("phone", trimmedPhone);
    formData.set("email", trimmedEmail);
    formData.set("address", trimmedAddress);
    formData.set("notes", trimmedNotes);

    const response = await action(formData);
    setResult(response);

    if (response.success) {
      showToast.success(
        mode === "create" ? "Cliente creado" : "Cliente actualizado",
        { position: "top-right" },
      );
      router.push(redirectHref);
    } else if (response.error) {
      showToast.error(response.error, { position: "top-right" });
    }
  }

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
          htmlFor="document_type_id"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Tipo de documento
        </label>
        <select
          id="document_type_id"
          name="document_type_id"
          value={selectedDocumentTypeId}
          onChange={(event) => {
            setSelectedDocumentTypeId(event.target.value);
            if (event.target.value === "") {
              setDocumentNumber("");
            }
          }}
          aria-describedby="document-type-help"
          aria-invalid={!!result?.fieldErrors?.document_type_id}
          className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
        >
          <option value="">Sin documento</option>
          {currentDocumentTypeInactive && customer?.documentTypeId ? (
            <option value={customer.documentTypeId} disabled>
              {customer.documentTypeName ?? "Tipo desconocido"} (inactivo)
            </option>
          ) : null}
          {documentTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
        {result?.fieldErrors?.document_type_id ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {result.fieldErrors.document_type_id}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="document_number"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Número de documento
        </label>
        <input
          id="document_number"
          name="document_number"
          type="text"
          maxLength={50}
          disabled={!selectedDocumentTypeId}
          value={documentNumber}
          onChange={(event) => setDocumentNumber(event.target.value)}
          aria-describedby="document-number-help"
          aria-invalid={!!result?.fieldErrors?.document_number}
          className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
        />
        {result?.fieldErrors?.document_number ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {result.fieldErrors.document_number}
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
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
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
          value={email}
          onChange={(event) => setEmail(event.target.value)}
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
          value={address}
          onChange={(event) => setAddress(event.target.value)}
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
          htmlFor="notes"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Notas
        </label>
        <textarea
          id="notes"
          name="notes"
          maxLength={1000}
          rows={4}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          aria-invalid={!!result?.fieldErrors?.notes}
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
    </form>
  );
}
