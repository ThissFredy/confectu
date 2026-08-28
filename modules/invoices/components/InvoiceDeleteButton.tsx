"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "nextjs-toast-notify";
import type { InvoiceActionResult } from "../types";

interface InvoiceDeleteButtonProps {
  invoiceId: string;
  action: (formData: FormData) => Promise<InvoiceActionResult>;
}

export function InvoiceDeleteButton({
  invoiceId,
  action,
}: InvoiceDeleteButtonProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    setPending(true);

    const formData = new FormData();
    formData.set("id", invoiceId);

    const response = await action(formData);

    setPending(false);

    if (response.success) {
      showToast.success("Borrador eliminado", { position: "top-right" });
      setShowConfirm(false);
      router.push("/invoices");
    } else if (response.error) {
      showToast.error(response.error, { position: "top-right" });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-red-300 px-4 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
      >
        Eliminar
      </button>

      {showConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Eliminar borrador
            </h2>
            <p className="mt-2 text-base text-zinc-600 dark:text-zinc-400">
              Se eliminará permanentemente. ¿Continuar?
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={pending}
                className="inline-flex h-12 min-h-[44px] w-full items-center justify-center rounded-lg bg-red-700 px-6 text-base font-medium text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-600 dark:hover:bg-red-700"
              >
                {pending ? "Eliminando..." : "Eliminar borrador"}
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={pending}
                className="inline-flex h-12 min-h-[44px] items-center justify-center rounded-lg border border-zinc-300 px-6 text-base font-medium text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
