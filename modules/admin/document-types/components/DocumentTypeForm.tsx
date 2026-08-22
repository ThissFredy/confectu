"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { showToast } from "nextjs-toast-notify";
import type { DocumentType, DocumentTypeActionResult } from "../types";

interface DocumentTypeFormProps {
  mode: "create" | "edit";
  documentType?: DocumentType;
  action: (formData: FormData) => Promise<DocumentTypeActionResult>;
}

const CODE_REGEX = /^[A-Z]{1,5}$/;

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
          ? "Crear tipo"
          : "Guardar cambios"}
    </button>
  );
}

export function DocumentTypeForm({
  mode,
  documentType,
  action,
}: DocumentTypeFormProps) {
  const router = useRouter();
  const [result, setResult] = useState<DocumentTypeActionResult | null>(null);

  async function handleAction(formData: FormData) {
    const code = String(formData.get("code") ?? "").toUpperCase().trim();
    const name = String(formData.get("name") ?? "").trim();

    const fieldErrors: Record<string, string> = {};

    if (code.length === 0) {
      fieldErrors.code = "El código es obligatorio.";
    } else if (!CODE_REGEX.test(code)) {
      fieldErrors.code = "El código debe tener 1 a 5 letras en mayúscula.";
    }

    if (name.length === 0) {
      fieldErrors.name = "El nombre es obligatorio.";
    } else if (name.length > 255) {
      fieldErrors.name = "El nombre debe tener máximo 255 caracteres.";
    }

    if (Object.keys(fieldErrors).length > 0) {
      setResult({ success: false, fieldErrors });
      return;
    }

    formData.set("code", code);
    formData.set("name", name);

    const response = await action(formData);
    setResult(response);

    if (response.success) {
      showToast.success(
        mode === "create"
          ? "Tipo de documento creado"
          : "Tipo de documento actualizado",
        { position: "top-right" },
      );
      router.push("/admin/document-types");
    } else if (response.error) {
      showToast.error(response.error, { position: "top-right" });
    }
  }

  return (
    <form action={handleAction} className="flex flex-col gap-6">
      {mode === "edit" && documentType ? (
        <input type="hidden" name="id" value={documentType.id} />
      ) : null}

      <div className="flex flex-col gap-2">
        <label
          htmlFor="code"
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Código
        </label>
        <input
          id="code"
          name="code"
          type="text"
          required
          pattern="^[A-Z]{1,5}$"
          maxLength={5}
          defaultValue={documentType?.code}
          onChange={(event) => {
            event.target.value = event.target.value.toUpperCase();
          }}
          aria-describedby="code-help"
          aria-invalid={!!result?.fieldErrors?.code}
          className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base uppercase text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
        />
        <p
          id="code-help"
          className="text-sm text-zinc-600 dark:text-zinc-400"
        >
          1 a 5 letras en mayúscula.
        </p>
        {result?.fieldErrors?.code ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {result.fieldErrors.code}
          </p>
        ) : null}
      </div>

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
          defaultValue={documentType?.name}
          aria-describedby="name-help"
          aria-invalid={!!result?.fieldErrors?.name}
          className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
        />
        <p
          id="name-help"
          className="text-sm text-zinc-600 dark:text-zinc-400"
        >
          Nombre del tipo de documento.
        </p>
        {result?.fieldErrors?.name ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {result.fieldErrors.name}
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
