"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AdminCustomerStatusToggle } from "@/modules/admin/clients/components/AdminCustomerStatusToggle";
import { ServiceReadOnlyList } from "@/modules/services/components/ServiceReadOnlyList";
import { WorkshopStatusToggle } from "./WorkshopStatusToggle";
import { toggleCustomerStatusAsAdmin } from "@/modules/admin/clients/actions";
import { toggleWorkshopStatus } from "../actions";
import type { WorkshopDetailsResult, WorkshopWithSettings } from "../types";
import type { Customer } from "@/modules/clients/types";
import type { Service } from "@/modules/services/types";

interface WorkshopListProps {
  workshops: WorkshopWithSettings[];
  loadDetailsAction: (
    formData: FormData,
  ) => Promise<WorkshopDetailsResult | { success: false; error: string }>;
}

type DetailsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "success"; customers: Customer[]; services: Service[] };

function SkeletonColumn() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-4 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-16 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-16 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-16 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

export function WorkshopList({
  workshops,
  loadDetailsAction,
}: WorkshopListProps) {
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [details, setDetails] = useState<Record<string, DetailsState>>({});

  const normalizedFilter = filter.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalizedFilter) {
      return workshops;
    }

    return workshops.filter((item) =>
      (item.settings?.businessName ?? "")
        .toLowerCase()
        .includes(normalizedFilter),
    );
  }, [workshops, normalizedFilter]);

  async function toggleWorkshop(workshopId: string) {
    const isExpanded = expanded[workshopId] ?? false;
    const nextExpanded = !isExpanded;

    setExpanded((value) => ({
      ...value,
      [workshopId]: nextExpanded,
    }));

    if (nextExpanded) {
      const currentDetails = details[workshopId];
      if (!currentDetails || currentDetails.status === "idle") {
        setDetails((value) => ({
          ...value,
          [workshopId]: { status: "loading" },
        }));

        const formData = new FormData();
        formData.set("workshop_id", workshopId);

        const response = await loadDetailsAction(formData);

        if (response.success) {
          setDetails((value) => ({
            ...value,
            [workshopId]: {
              status: "success",
              customers: response.customers,
              services: response.services,
            },
          }));
        } else {
          setDetails((value) => ({
            ...value,
            [workshopId]: { status: "error", error: response.error },
          }));
        }
      }
    }
  }

  if (workshops.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-zinc-200 px-4 py-12 text-center dark:border-zinc-800">
        <p className="text-lg text-zinc-900 dark:text-zinc-100">
          No hay talleres.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        type="text"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Filtrar por nombre comercial"
        aria-label="Filtrar talleres"
        className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10 sm:max-w-sm"
      />

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-zinc-600 dark:text-zinc-400">
          No se encontraron talleres con ese filtro.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {filtered.map((item) => {
            const businessName =
              item.settings?.businessName ?? "Sin nombre comercial";
            const isExpanded = expanded[item.workshop.id] ?? false;
            const currentDetails = details[item.workshop.id] ?? {
              status: "idle",
            };

            return (
              <li
                key={item.workshop.id}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800"
              >
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => toggleWorkshop(item.workshop.id)}
                      className="flex items-center gap-2 text-left"
                      aria-expanded={isExpanded}
                      aria-controls={`workshop-details-${item.workshop.id}`}
                    >
                      <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                        {businessName}
                      </span>
                      <span className="text-zinc-500 md:hidden">
                        {isExpanded ? "▲" : "▼"}
                      </span>
                    </button>
                    <span
                      className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        item.workshop.isActive
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {item.workshop.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/workshops/${item.workshop.id}`}
                      className="inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Editar
                    </Link>
                    <WorkshopStatusToggle
                      workshop={item.workshop}
                      action={toggleWorkshopStatus}
                    />
                  </div>
                </div>

                <div
                  id={`workshop-details-${item.workshop.id}`}
                  className={`border-t border-zinc-200 dark:border-zinc-800 ${isExpanded ? "block" : "hidden md:hidden"}`}
                >
                  {currentDetails.status === "loading" ? (
                    <div className="grid gap-6 p-4 md:grid-cols-2">
                      <SkeletonColumn />
                      <SkeletonColumn />
                    </div>
                  ) : currentDetails.status === "error" ? (
                    <div className="p-4">
                      <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
                        {currentDetails.error}
                      </p>
                    </div>
                  ) : currentDetails.status === "success" ? (
                    <div className="grid gap-6 p-4 md:grid-cols-2">
                      <div>
                        <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          Clientes
                        </h3>
                        {currentDetails.customers.length === 0 ? (
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            Sin clientes.
                          </p>
                        ) : (
                          <ul className="flex flex-col gap-2">
                            {currentDetails.customers.map((customer) => {
                              const document = [
                                customer.documentTypeName,
                                customer.documentNumber,
                              ]
                                .filter(Boolean)
                                .join(": ");

                              return (
                                <li
                                  key={customer.id}
                                  className="flex flex-col gap-3 rounded-lg border border-zinc-100 p-3 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div className="flex flex-col gap-1">
                                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                      {customer.name}
                                    </p>
                                    {document && (
                                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                        {document}
                                      </p>
                                    )}
                                    {(customer.phone || customer.email) && (
                                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                        {[customer.phone, customer.email]
                                          .filter(Boolean)
                                          .join(" · ")}
                                      </p>
                                    )}
                                    <span
                                      className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium ${
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
                                      href={`/admin/workshops/${item.workshop.id}/customers/${customer.id}`}
                                      className="inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                                    >
                                      Editar
                                    </Link>
                                    <AdminCustomerStatusToggle
                                      customer={customer}
                                      action={toggleCustomerStatusAsAdmin}
                                    />
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>

                      <div>
                        <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          Servicios
                        </h3>
                        <ServiceReadOnlyList
                          services={currentDetails.services}
                          emptyMessage="Sin servicios."
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
