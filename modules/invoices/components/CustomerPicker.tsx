"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { showToast } from "nextjs-toast-notify";
import type { Customer } from "@/modules/clients/types";
import { createCustomerFromInvoice } from "../actions";
import type { CustomerFromInvoiceResult } from "../types";

interface CustomerPickerProps {
  selectedCustomerId: string | null;
  onSelect: (customerId: string) => void;
  customers: Customer[];
}

function CreateCustomerSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-12 min-h-[44px] w-full items-center justify-center rounded-lg bg-zinc-900 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {pending ? "Creando..." : "Crear cliente"}
    </button>
  );
}

export function CustomerPicker({
  selectedCustomerId,
  onSelect,
  customers,
}: CustomerPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createResult, setCreateResult] = useState<CustomerFromInvoiceResult | null>(
    null,
  );

  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredCustomers = useMemo(() => {
    if (!normalizedQuery) {
      return customers;
    }

    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(normalizedQuery) ||
        (customer.documentNumber ?? "")
          .toLowerCase()
          .includes(normalizedQuery) ||
        (customer.phone ?? "").toLowerCase().includes(normalizedQuery),
    );
  }, [customers, normalizedQuery]);

  const selectedCustomer = useMemo(() => {
    return customers.find((customer) => customer.id === selectedCustomerId) ?? null;
  }, [customers, selectedCustomerId]);

  async function handleCreateCustomer() {
    const formData = new FormData();
    formData.set("name", newCustomer.name.trim());
    formData.set("phone", newCustomer.phone.trim());
    formData.set("email", newCustomer.email.trim());
    formData.set("address", newCustomer.address.trim());

    const response = await createCustomerFromInvoice(formData);
    setCreateResult(response);

    if (response.success && response.customerId) {
      showToast.success("Cliente creado", { position: "top-right" });
      onSelect(response.customerId);
      setShowCreateForm(false);
      setNewCustomer({
        name: "",
        phone: "",
        email: "",
        address: "",
      });
    } else if (response.error) {
      showToast.error(response.error, { position: "top-right" });
    }
  }

  if (selectedCustomer) {
    return (
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {selectedCustomer.name}
            </p>
            {selectedCustomer.documentNumber ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {selectedCustomer.documentTypeName
                  ? `${selectedCustomer.documentTypeName}: `
                  : "Documento: "}
                {selectedCustomer.documentNumber}
              </p>
            ) : null}
            {selectedCustomer.phone ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Tel: {selectedCustomer.phone}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onSelect("")}
            className="inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Cambiar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {!showCreateForm ? (
        <>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Buscar cliente por nombre o documento"
            aria-label="Buscar cliente"
            className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
          />

          <div className="flex flex-col gap-2">
            {filteredCustomers.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                {normalizedQuery
                  ? "No se encontraron clientes."
                  : "No hay clientes registrados."}
              </p>
            ) : (
              <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                {filteredCustomers.map((customer) => (
                  <li key={customer.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(customer.id)}
                      className="flex w-full flex-col gap-0.5 rounded-lg px-4 py-3 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <span className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                        {customer.name}
                      </span>
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        {customer.documentNumber
                          ? `${customer.documentTypeName ? `${customer.documentTypeName}: ` : ""}${customer.documentNumber}`
                          : "Sin documento"}
                        {customer.phone ? ` · ${customer.phone}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="inline-flex h-12 min-h-[44px] items-center justify-center rounded-lg border border-zinc-300 px-6 text-base font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Crear cliente nuevo
          </button>
        </>
      ) : (
        <form action={handleCreateCustomer} className="flex flex-col gap-4">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Crear cliente nuevo
          </h3>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="new_customer_name"
              className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
            >
              Nombre
            </label>
            <input
              id="new_customer_name"
              type="text"
              required
              maxLength={255}
              value={newCustomer.name}
              onChange={(event) =>
                setNewCustomer({ ...newCustomer, name: event.target.value })
              }
              className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
            />
            {createResult?.fieldErrors?.name ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                {createResult.fieldErrors.name}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="new_customer_phone"
              className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
            >
              Teléfono
            </label>
            <input
              id="new_customer_phone"
              type="tel"
              value={newCustomer.phone}
              onChange={(event) =>
                setNewCustomer({ ...newCustomer, phone: event.target.value })
              }
              className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
            />
            {createResult?.fieldErrors?.phone ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                {createResult.fieldErrors.phone}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="new_customer_email"
              className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
            >
              Correo electrónico
            </label>
            <input
              id="new_customer_email"
              type="email"
              value={newCustomer.email}
              onChange={(event) =>
                setNewCustomer({ ...newCustomer, email: event.target.value })
              }
              className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
            />
            {createResult?.fieldErrors?.email ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                {createResult.fieldErrors.email}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="new_customer_address"
              className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
            >
              Dirección
            </label>
            <input
              id="new_customer_address"
              type="text"
              value={newCustomer.address}
              onChange={(event) =>
                setNewCustomer({ ...newCustomer, address: event.target.value })
              }
              className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
            />
            {createResult?.fieldErrors?.address ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                {createResult.fieldErrors.address}
              </p>
            ) : null}
          </div>

          {createResult?.error ? (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
              {createResult.error}
            </p>
          ) : null}

          <CreateCustomerSubmitButton />

          <button
            type="button"
            onClick={() => setShowCreateForm(false)}
            className="inline-flex h-12 min-h-[44px] items-center justify-center rounded-lg border border-zinc-300 px-6 text-base font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Cancelar
          </button>
        </form>
      )}
    </div>
  );
}
