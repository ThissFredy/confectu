"use client";

import { useState } from "react";
import { showToast } from "nextjs-toast-notify";
import type { InvoiceActionResult } from "../types";

interface InvoiceIssueButtonProps {
  invoiceId: string;
  paymentMethod?: string;
  paymentInstructions?: string;
  action: (formData: FormData) => Promise<InvoiceActionResult>;
}

export function InvoiceIssueButton({
  invoiceId,
  paymentMethod = "",
  paymentInstructions = "",
  action,
}: InvoiceIssueButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    setPending(true);

    const formData = new FormData();
    formData.set("id", invoiceId);
    formData.set("payment_method", paymentMethod.trim());
    formData.set("payment_instructions", paymentInstructions.trim());

    const response = await action(formData);

    setPending(false);

    if (response.success) {
      showToast.success("Factura emitida", { position: "top-right" });
      setShowConfirm(false);
    } else if (response.error) {
      showToast.error(response.error, { position: "top-right" });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="inline-flex h-12 min-h-[44px] w-full items-center justify-center rounded-lg bg-green-700 px-6 text-base font-medium text-white transition-colors hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700"
      >
        Emitir factura
      </button>

      {showConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Emitir factura
            </h2>
            <p className="mt-2 text-base text-zinc-600 dark:text-zinc-400">
              ¿Seguro que deseas emitir esta factura? Una vez emitida no se podrá
              editar.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={pending}
                className="inline-flex h-12 min-h-[44px] w-full items-center justify-center rounded-lg bg-green-700 px-6 text-base font-medium text-white transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-green-600 dark:hover:bg-green-700"
              >
                {pending ? "Emitiendo..." : "Emitir factura"}
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
