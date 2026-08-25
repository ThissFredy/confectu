import Link from "next/link";

export function NotFoundNotice() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        Servicio no encontrado.
      </h2>
      <Link
        href="/services"
        className="mt-6 inline-flex h-12 min-h-[44px] items-center justify-center rounded-lg bg-zinc-900 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Volver a la lista
      </Link>
    </div>
  );
}
