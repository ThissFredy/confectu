"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { showToast } from "nextjs-toast-notify";
import type { Service, ServiceActionResult } from "../types";

interface SubmitButtonProps {
  label: string;
}

function SubmitButton({ label }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-4 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950"
    >
      {pending ? "Procesando..." : label}
    </button>
  );
}

interface ServiceDeleteButtonProps {
  service: Service;
  action: (formData: FormData) => Promise<ServiceActionResult>;
}

export function ServiceDeleteButton({
  service,
  action,
}: ServiceDeleteButtonProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | null>(null);

  async function handleAction(formData: FormData) {
    const response = await action(formData);

    if (response.success) {
      showToast.success("Servicio eliminado", { position: "top-right" });
      setStep(null);
      router.refresh();
    } else {
      showToast.error(
        response.error ?? "No se pudo eliminar el servicio.",
        { position: "top-right" },
      );
    }
  }

  return (
    <div>
      {step === null ? (
        <button
          type="button"
          onClick={() => setStep(1)}
          aria-label={`Eliminar servicio ${service.name}`}
          className="inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-4 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
        >
          Eliminar
        </button>
      ) : (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="service-delete-title"
          className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <p
            id="service-delete-title"
            className="text-sm text-zinc-700 dark:text-zinc-300"
          >
            {step === 1
              ? "¿Estás seguro de eliminar este servicio? Esta acción es irreversible."
              : "Esta acción es definitiva. ¿Confirmar eliminación?"}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep(null)}
              className="inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
            {step === 1 ? (
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-4 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
              >
                Sí, continuar
              </button>
            ) : (
              <form action={handleAction}>
                <input type="hidden" name="id" value={service.id} />
                <SubmitButton label="Confirmar" />
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
