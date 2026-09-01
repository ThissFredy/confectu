"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { showToast } from "nextjs-toast-notify";
import { deleteMyAccount } from "../actions";
import type { AuthActionResult } from "../types";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-4 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950"
    >
      {pending ? "Eliminando..." : "Confirmar"}
    </button>
  );
}

export function DeleteAccountButton() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | null>(null);

  async function handleAction(formData: FormData) {
    const response: AuthActionResult = await deleteMyAccount(formData);

    if (response.success) {
      showToast.success(
        "Tu cuenta ha sido eliminada. Puedes reactivarla contactándonos.",
        { position: "top-right" },
      );
      setStep(null);
      router.replace("/");
    } else {
      showToast.error(
        response.error ?? "No se pudo eliminar la cuenta. Intenta de nuevo.",
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
          className="inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-4 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
        >
          Eliminar cuenta
        </button>
      ) : (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-confirm-title"
          className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <p
            id="delete-account-confirm-title"
            className="text-sm text-zinc-700 dark:text-zinc-300"
          >
            {step === 1
              ? "¿Estás seguro de eliminar tu cuenta? Se desactivará y cerraremos tu sesión."
              : "Tus datos se conservan y puedes reactivar tu cuenta contactándonos. ¿Confirmar eliminación?"}
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
                <input type="hidden" name="confirm" value="true" />
                <SubmitButton />
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
