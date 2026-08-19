"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function WorkshopSetupSuccessModal() {
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  const handleContinue = () => {
    router.push("/dashboard");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-success-title"
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
      >
        <h2
          id="setup-success-title"
          className="text-xl font-semibold text-zinc-900 dark:text-zinc-100"
        >
          Taller configurado
        </h2>
        <p className="mt-2 text-base text-zinc-600 dark:text-zinc-400">
          Tu taller está listo para empezar a usar Confectu.
        </p>
        <button
          ref={buttonRef}
          type="button"
          onClick={handleContinue}
          className="mt-6 flex h-12 min-h-[44px] w-full items-center justify-center rounded-lg bg-zinc-900 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
