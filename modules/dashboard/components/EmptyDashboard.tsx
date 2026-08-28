import Link from "next/link";

export function EmptyDashboard() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-zinc-200 px-4 py-12 text-center dark:border-zinc-800">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        Aún no tienes facturas
      </h2>
      <p className="max-w-sm text-zinc-600 dark:text-zinc-400">
        Crea tu primera factura para empezar a ver el resumen operativo de tu
        taller.
      </p>
      <Link
        href="/invoices/new"
        className="inline-flex h-12 min-h-[44px] items-center justify-center rounded-lg bg-zinc-900 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Crear factura
      </Link>
    </div>
  );
}
