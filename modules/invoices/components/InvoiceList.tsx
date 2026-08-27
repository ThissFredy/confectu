"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { InvoicePdfLink } from "./InvoicePdfLink";
import type { InvoiceListItem, InvoiceStatus } from "../types";

interface InvoiceListProps {
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

const statusOptions: Array<{ value: "all" | InvoiceStatus; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "draft", label: "Borradores" },
  { value: "issued", label: "Emitidas" },
  { value: "void", label: "Anuladas" },
];

export function InvoiceList({ invoices }: InvoiceListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | InvoiceStatus>("all");

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filtered = useMemo(() => {
    return invoices.filter((invoice) => {
      const matchesStatus =
        statusFilter === "all" || invoice.status === statusFilter;

      const numberText =
        invoice.number !== null ? String(invoice.number).toLowerCase() : "";
      const matchesSearch =
        normalizedQuery.length === 0 ||
        invoice.customerName.toLowerCase().includes(normalizedQuery) ||
        numberText.includes(normalizedQuery);

      return matchesStatus && matchesSearch;
    });
  }, [invoices, statusFilter, normalizedQuery]);

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-zinc-200 px-4 py-12 text-center dark:border-zinc-800">
        <p className="text-lg text-zinc-900 dark:text-zinc-100">
          No hay facturas.
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Buscar por número o cliente"
          aria-label="Buscar facturas"
          className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10 sm:max-w-sm"
        />
        <Link
          href="/invoices/new"
          className="inline-flex h-12 min-h-[44px] items-center justify-center rounded-lg bg-zinc-900 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Crear factura
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {statusOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setStatusFilter(option.value)}
            className={`inline-flex h-10 min-h-[44px] items-center rounded-full px-4 text-sm font-medium transition-colors ${
              statusFilter === option.value
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-zinc-600 dark:text-zinc-400">
          No se encontraron facturas con ese filtro.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((invoice) => (
            <li
              key={invoice.id}
              className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between"
            >
              <Link
                href={`/invoices/${invoice.id}`}
                className="flex flex-col gap-1"
              >
                <div className="flex items-center gap-2">
                  <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    {invoice.number !== null
                      ? `Factura ${invoice.number}`
                      : "Borrador"}
                  </p>
                  <InvoiceStatusBadge status={invoice.status} />
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {invoice.customerName}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {formatDate(invoice.createdAt)} ·{" "}
                  {formatCurrency(invoice.totalCop)}
                </p>
              </Link>

              <div className="flex items-center gap-2">
                <InvoicePdfLink invoiceId={invoice.id} />
                <Link
                  href={`/invoices/${invoice.id}`}
                  className="inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  Ver
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
