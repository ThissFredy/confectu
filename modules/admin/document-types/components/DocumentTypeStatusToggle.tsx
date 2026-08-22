"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { showToast } from "nextjs-toast-notify";
import { toggleDocumentTypeStatus } from "../actions";
import type { DocumentType } from "../types";

interface SubmitButtonProps {
  label: string;
  variant: "danger" | "primary";
}

function SubmitButton({ label, variant }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  const baseClasses =
    "inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60";
  const variantClasses =
    variant === "danger"
      ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
      : "text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800";

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${baseClasses} ${variantClasses}`}
    >
      {pending ? "Procesando..." : label}
    </button>
  );
}

interface DocumentTypeStatusToggleProps {
  documentType: DocumentType;
}

export function DocumentTypeStatusToggle({
  documentType,
}: DocumentTypeStatusToggleProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleAction(formData: FormData) {
    const response = await toggleDocumentTypeStatus(formData);

    if (response.success) {
      showToast.success(
        documentType.isActive
          ? "Tipo de documento desactivado"
          : "Tipo de documento reactivado",
        { position: "top-right" },
      );
      setConfirmOpen(false);
      router.refresh();
    } else {
      showToast.error(
        response.error ?? "No se pudo actualizar el estado.",
        { position: "top-right" },
      );
    }
  }

  if (!documentType.isActive) {
    return (
      <form action={handleAction}>
        <input type="hidden" name="id" value={documentType.id} />
        <SubmitButton label="Reactivar" variant="primary" />
      </form>
    );
  }

  return (
    <div>
      {!confirmOpen ? (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          aria-label="Desactivar tipo de documento"
          className="inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-4 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
        >
          Desactivar
        </button>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            ¿Desactivar este tipo de documento? Los clientes que lo referencian
            conservarán la referencia.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <form action={handleAction}>
              <input type="hidden" name="id" value={documentType.id} />
              <SubmitButton label="Desactivar" variant="danger" />
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
