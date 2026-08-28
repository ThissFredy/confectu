import Link from "next/link";

interface NotFoundNoticeProps {
  message?: string;
  backHref?: string;
  backLabel?: string;
}

export function NotFoundNotice({
  message = "No se encontró la factura.",
  backHref = "/invoices",
  backLabel = "Volver a facturas",
}: NotFoundNoticeProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-12 text-center">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        {message}
      </h1>
      <Link
        href={backHref}
        className="mt-6 inline-flex h-12 min-h-[44px] items-center justify-center rounded-lg bg-zinc-900 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {backLabel}
      </Link>
    </div>
  );
}
