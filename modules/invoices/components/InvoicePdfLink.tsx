import Link from "next/link";

interface InvoicePdfLinkProps {
  invoiceId: string;
  label?: string;
}

export function InvoicePdfLink({
  invoiceId,
  label = "Descargar PDF",
}: InvoicePdfLinkProps) {
  return (
    <Link
      href={`/invoices/${invoiceId}/pdf`}
      download
      className="inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
    >
      {label}
    </Link>
  );
}
