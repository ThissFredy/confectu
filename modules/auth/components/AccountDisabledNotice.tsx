import Link from "next/link";

export function AccountDisabledNotice() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-12 text-center">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Cuenta desactivada
        </h1>
        <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400">
          Tu cuenta está desactivada. Contacta al administrador para reactivarla.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            className="flex h-12 min-h-[44px] w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-6 text-base font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Contacto
          </button>
          <Link
            href="/"
            className="flex h-12 min-h-[44px] w-full items-center justify-center rounded-lg bg-zinc-900 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
