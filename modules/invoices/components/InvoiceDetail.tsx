import { InvoiceVoidButton } from "./InvoiceVoidButton";
import { InvoicePdfLink } from "./InvoicePdfLink";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { voidInvoice } from "../actions";
import type { InvoiceWithRelations } from "../types";

interface InvoiceDetailProps {
  invoice: InvoiceWithRelations;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

export function InvoiceDetail({ invoice }: InvoiceDetailProps) {
  const { invoice: header, customer, lines, adjustments } = invoice;
  const displayNumber =
    header.status === "draft" || header.number === null
      ? "Sin número"
      : `${header.number}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Factura {displayNumber}
            </p>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {formatCurrency(header.totalCop)}
            </h1>
          </div>
          <InvoiceStatusBadge status={header.status} />
        </div>

        <div className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            <span className="font-medium">Fecha de emisión:</span>{" "}
            {formatDate(header.issuedAt ?? header.createdAt)}
          </p>
          {header.voidedAt ? (
            <p>
              <span className="font-medium">Anulada el:</span>{" "}
              {formatDate(header.voidedAt)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Cliente
        </h2>
        <div className="mt-2 flex flex-col gap-1 text-base text-zinc-700 dark:text-zinc-300">
          <p className="font-medium">{customer.name}</p>
          {customer.documentNumber ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {customer.documentTypeName
                ? `${customer.documentTypeName}: `
                : "Documento: "}
              {customer.documentNumber}
            </p>
          ) : null}
          {customer.phone ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Tel: {customer.phone}
            </p>
          ) : null}
          {customer.email ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Email: {customer.email}
            </p>
          ) : null}
          {customer.address ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Dir: {customer.address}
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Líneas
        </h2>
        <ul className="mt-3 flex flex-col gap-3">
          {lines.map((line) => (
            <li
              key={line.id}
              className="flex flex-col gap-1 border-b border-zinc-100 pb-3 last:border-0 last:pb-0 dark:border-zinc-800"
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-base text-zinc-900 dark:text-zinc-100">
                  {line.descriptionSnapshot}
                </p>
                <p className="whitespace-nowrap text-base font-medium text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(line.lineTotalCop)}
                </p>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {line.quantity} × {formatCurrency(line.unitPriceCop)}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {adjustments.length > 0 ? (
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Ajustes
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {adjustments.map((adjustment) => (
              <li
                key={adjustment.id}
                className="flex items-center justify-between text-base"
              >
                <span className="text-zinc-700 dark:text-zinc-300">
                  {adjustment.label}
                </span>
                <span
                  className={
                    adjustment.effect === "add"
                      ? "font-medium text-zinc-900 dark:text-zinc-100"
                      : "font-medium text-red-600 dark:text-red-400"
                  }
                >
                  {adjustment.effect === "add" ? "+" : "−"}{" "}
                  {formatCurrency(adjustment.amountCop)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-base text-zinc-700 dark:text-zinc-300">
            <span>Subtotal</span>
            <span>{formatCurrency(header.subtotalCop)}</span>
          </div>
          <div className="flex items-center justify-between text-base text-zinc-700 dark:text-zinc-300">
            <span>Total ajustes</span>
            <span>{formatCurrency(header.totalAdjustmentsCop)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-zinc-200 pt-2 text-lg font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
            <span>Total</span>
            <span>{formatCurrency(header.totalCop)}</span>
          </div>
        </div>
      </div>

      {header.paymentMethod || header.paymentInstructions ? (
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Información de pago
          </h2>
          <div className="mt-2 flex flex-col gap-1">
            {header.paymentMethod ? (
              <p className="text-base text-zinc-700 dark:text-zinc-300">
                <span className="font-medium">Método:</span>{" "}
                {header.paymentMethod}
              </p>
            ) : null}
            {header.paymentInstructions ? (
              <p className="whitespace-pre-wrap text-base text-zinc-600 dark:text-zinc-400">
                {header.paymentInstructions}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {header.notes ? (
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Notas internas
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-base text-zinc-600 dark:text-zinc-400">
            {header.notes}
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <InvoicePdfLink invoiceId={header.id} />
        {header.status === "issued" ? (
          <InvoiceVoidButton invoiceId={header.id} action={voidInvoice} />
        ) : null}
      </div>
    </div>
  );
}
