"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CustomerStatusToggle } from "./CustomerStatusToggle";
import { toggleCustomerStatus } from "../actions";
import type { Customer, CustomerActionResult } from "../types";

interface CustomerListProps {
  customers: Customer[];
  statusToggleAction?: (formData: FormData) => Promise<CustomerActionResult>;
}

export function CustomerList({ customers, statusToggleAction = toggleCustomerStatus }: CustomerListProps) {
  const [filter, setFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const normalizedFilter = filter.trim().toLowerCase();

  const filtered = useMemo(() => {
    const visible = showInactive
      ? customers
      : customers.filter((customer) => customer.isActive);

    if (!normalizedFilter) {
      return visible;
    }

    return visible.filter((customer) => {
      const document = [customer.documentTypeName, customer.documentNumber]
        .filter(Boolean)
        .join(" ");

      return (
        customer.name.toLowerCase().includes(normalizedFilter) ||
        document.toLowerCase().includes(normalizedFilter) ||
        (customer.phone?.toLowerCase().includes(normalizedFilter) ?? false) ||
        (customer.email?.toLowerCase().includes(normalizedFilter) ?? false)
      );
    });
  }, [customers, normalizedFilter, showInactive]);

  if (customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-zinc-200 px-4 py-12 text-center dark:border-zinc-800">
        <p className="text-lg text-zinc-900 dark:text-zinc-100">
          No hay clientes.
        </p>
        <Link
          href="/customers/new"
          className="inline-flex h-12 min-h-[44px] items-center justify-center rounded-lg bg-zinc-900 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Crear cliente
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Buscar por nombre, documento, teléfono o correo"
          aria-label="Buscar clientes"
          className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10 sm:max-w-sm"
        />
        <Link
          href="/customers/new"
          className="inline-flex h-12 min-h-[44px] items-center justify-center rounded-lg bg-zinc-900 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Crear cliente
        </Link>
      </div>

      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(event) => setShowInactive(event.target.checked)}
          className="h-5 w-5 accent-zinc-900 dark:accent-zinc-100"
        />
        <span className="text-base text-zinc-900 dark:text-zinc-100">
          Mostrar inactivos
        </span>
      </label>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-zinc-600 dark:text-zinc-400">
          {showInactive && customers.some((customer) => !customer.isActive)
            ? "No se encontraron clientes con ese filtro."
            : showInactive
              ? "No hay clientes inactivos."
              : "No se encontraron clientes con ese filtro."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((customer) => (
            <li
              key={customer.id}
              className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-1">
                <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {customer.name}
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {customer.documentTypeName && customer.documentNumber
                    ? `${customer.documentTypeName}: ${customer.documentNumber}`
                    : customer.documentTypeName ?? customer.documentNumber ??
                      "Sin documento"}
                </p>
                {(customer.phone || customer.email) && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {[customer.phone, customer.email].filter(Boolean).join(" · ")}
                  </p>
                )}
                <span
                  className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    customer.isActive
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {customer.isActive ? "Activo" : "Inactivo"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/customers/${customer.id}`}
                  className="inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  Editar
                </Link>
                <CustomerStatusToggle
                  customer={customer}
                  action={statusToggleAction}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
