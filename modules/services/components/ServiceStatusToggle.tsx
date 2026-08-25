"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { showToast } from "nextjs-toast-notify";
import type { Service, ServiceActionResult } from "../types";

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

interface ServiceStatusToggleProps {
  service: Service;
  action: (formData: FormData) => Promise<ServiceActionResult>;
}

export function ServiceStatusToggle({
  service,
  action,
}: ServiceStatusToggleProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | null>(null);

  async function handleAction(formData: FormData) {
    const response = await action(formData);

    if (response.success) {
      showToast.success(
        service.isActive ? "Servicio desactivado" : "Servicio reactivado",
        { position: "top-right" },
      );
      setStep(null);
      router.refresh();
    } else {
      showToast.error(
        response.error ?? "No se pudo actualizar el estado.",
        { position: "top-right" },
      );
    }
  }

  const actionLabel = service.isActive ? "desactivar" : "reactivar";
  const actionNoun = service.isActive ? "desactivación" : "reactivación";
  const buttonLabel = service.isActive ? "Desactivar" : "Reactivar";
  const buttonVariant = service.isActive ? "danger" : "primary";

  return (
    <div>
      {step === null ? (
        <button
          type="button"
          onClick={() => setStep(1)}
          aria-label={`${buttonLabel} servicio ${service.name}`}
          className={`inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors ${
            service.isActive
              ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
              : "text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          {buttonLabel}
        </button>
      ) : (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="service-toggle-title"
          className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <p
            id="service-toggle-title"
            className="text-sm text-zinc-700 dark:text-zinc-300"
          >
            {step === 1
              ? `¿Estás seguro de ${actionLabel} este servicio?`
              : `Esta acción es definitiva. ¿Confirmar ${actionNoun}?`}
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
                className={`inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors ${
                  service.isActive
                    ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                    : "text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                Sí, continuar
              </button>
            ) : (
              <form action={handleAction}>
                <input type="hidden" name="id" value={service.id} />
                <SubmitButton label="Confirmar" variant={buttonVariant} />
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
