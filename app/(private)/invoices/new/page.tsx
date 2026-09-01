import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RetryButton } from "@/modules/admin/components/RetryButton";
import { InvoiceForm } from "@/modules/invoices/components/InvoiceForm";
import { createInvoiceDraft } from "@/modules/invoices/actions";
import { listActiveServices } from "@/modules/services/queries";
import { listCustomers } from "@/modules/clients/queries";
import { getCurrentWorkshopSettings } from "@/modules/workshops/queries";
import type { Service } from "@/modules/services/types";
import type { Customer } from "@/modules/clients/types";

export default async function NewInvoicePage() {
  const supabase = await createClient();

  let services: Service[] = [];
  let customers: Customer[] = [];
  let hasError = false;

  try {
    [services, customers] = await Promise.all([
      listActiveServices(supabase),
      listCustomers(supabase, { includeInactive: false }),
    ]);
  } catch {
    hasError = true;
  }

  const settings = await getCurrentWorkshopSettings(supabase).catch(() => null);

  if (hasError) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          No se pudieron cargar los datos.
        </h2>
        <div className="mt-6 flex flex-col gap-3">
          <RetryButton />
          <Link
            href="/invoices"
            className="inline-flex h-12 min-h-[44px] items-center justify-center rounded-lg border border-zinc-300 px-6 text-base font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Volver a facturas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="mb-6">
        <Link
          href="/invoices"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Volver a la lista
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Crear factura
        </h1>
      </div>

      <div className="max-w-2xl">
        <InvoiceForm
          mode="create"
          services={services}
          customers={customers}
          defaultPaymentInstructions={settings?.paymentInstructions ?? undefined}
          action={createInvoiceDraft}
        />
      </div>
    </div>
  );
}
