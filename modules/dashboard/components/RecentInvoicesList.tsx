import Link from "next/link";
import { InvoiceStatusBadge } from "@/modules/invoices/components/InvoiceStatusBadge";
import type { InvoiceListItem } from "@/modules/invoices/types";

interface RecentInvoicesListProps {
  invoices: InvoiceListItem[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function RecentInvoicesList({ invoices }: RecentInvoicesListProps) {
  if (invoices.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Facturas recientes
      </h2>

      <ul className="flex flex-col gap-2">
        {invoices.map((invoice) => (
          <li key={invoice.id}>
            <Link
              href={`/invoices/${invoice.id}`}
              className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    {invoice.number !== null
                      ? `Factura ${invoice.number}`
                      : "Borrador"}
                  </p>
                  <InvoiceStatusBadge status={invoice.status} />
                </div>
                <p className="shrink-0 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(invoice.totalCop)}
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <p className="truncate">{invoice.customerName}</p>
                <p className="shrink-0">{formatDate(invoice.createdAt)}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
