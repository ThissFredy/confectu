import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RetryButton } from "@/modules/admin/components/RetryButton";
import { InvoiceList } from "@/modules/invoices/components/InvoiceList";
import { listInvoices } from "@/modules/invoices/queries";
import type { InvoiceListItem } from "@/modules/invoices/types";

export default async function InvoicesPage() {
  const supabase = await createClient();

  let invoices: InvoiceListItem[] = [];
  let hasError = false;

  try {
    invoices = await listInvoices(supabase);
  } catch {
    hasError = true;
  }

  if (hasError) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          No se pudieron cargar las facturas.
        </h2>
        <div className="mt-6">
          <RetryButton />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Facturas
        </h1>
      </div>
      <InvoiceList invoices={invoices} />
    </div>
  );
}
