"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ServiceStatusToggle } from "./ServiceStatusToggle";
import { ServiceDeleteButton } from "./ServiceDeleteButton";
import { toggleServiceStatus, deleteService } from "../actions";
import type { Service, ServiceActionResult } from "../types";

interface ServiceListProps {
  services: Service[];
  statusToggleAction?: (formData: FormData) => Promise<ServiceActionResult>;
  deleteAction?: (formData: FormData) => Promise<ServiceActionResult>;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function ServiceList({
  services,
  statusToggleAction = toggleServiceStatus,
  deleteAction = deleteService,
}: ServiceListProps) {
  const [filter, setFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const normalizedFilter = filter.trim().toLowerCase();

  const filtered = useMemo(() => {
    const visible = showInactive
      ? services
      : services.filter((service) => service.isActive);

    if (!normalizedFilter) {
      return visible;
    }

    return visible.filter((service) =>
      service.name.toLowerCase().includes(normalizedFilter),
    );
  }, [services, normalizedFilter, showInactive]);

  if (services.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-zinc-200 px-4 py-12 text-center dark:border-zinc-800">
        <p className="text-lg text-zinc-900 dark:text-zinc-100">
          No hay servicios.
        </p>
        <Link
          href="/services/new"
          className="inline-flex h-12 min-h-[44px] items-center justify-center rounded-lg bg-zinc-900 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Crear servicio
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
          placeholder="Buscar por nombre"
          aria-label="Buscar servicios"
          className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10 sm:max-w-sm"
        />
        <Link
          href="/services/new"
          className="inline-flex h-12 min-h-[44px] items-center justify-center rounded-lg bg-zinc-900 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Crear servicio
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
          {showInactive && services.some((service) => !service.isActive)
            ? "No se encontraron servicios con ese filtro."
            : showInactive
              ? "No hay servicios inactivos."
              : "No se encontraron servicios con ese filtro."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((service) => (
            <li
              key={service.id}
              className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-1">
                <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {service.name}
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {service.category ?? "Sin categoría"}
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {formatCurrency(service.defaultPriceCop)}
                </p>
                <span
                  className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    service.isActive
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {service.isActive ? "Activo" : "Inactivo"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/services/${service.id}`}
                  className="inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  Editar
                </Link>
                <ServiceStatusToggle
                  service={service}
                  action={statusToggleAction}
                />
                <ServiceDeleteButton
                  service={service}
                  action={deleteAction}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
