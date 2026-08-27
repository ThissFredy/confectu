import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { InvoiceForm } from "@/modules/invoices/components/InvoiceForm";
import { InvoiceDetail } from "@/modules/invoices/components/InvoiceDetail";
import { NotFoundNotice } from "@/modules/invoices/components/NotFoundNotice";
import {
  updateInvoiceDraft,
  issueInvoice,
  deleteInvoice,
} from "@/modules/invoices/actions";
import { getInvoiceById } from "@/modules/invoices/queries";
import { listActiveServices } from "@/modules/services/queries";
import { listCustomers } from "@/modules/clients/queries";

interface InvoiceDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({
  params,
}: InvoiceDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  let invoice = null;
  let services: Awaited<ReturnType<typeof listActiveServices>> = [];
  let customers: Awaited<ReturnType<typeof listCustomers>> = [];
  let hasError = false;

  try {
    invoice = await getInvoiceById(supabase, id);

    if (invoice?.invoice.status === "draft") {
      [services, customers] = await Promise.all([
        listActiveServices(supabase),
        listCustomers(supabase, { includeInactive: false }),
      ]);
    }
  } catch {
    hasError = true;
  }

  if (hasError || !invoice) {
    return (
      <div className="px-4 py-6 md:px-8">
        <NotFoundNotice />
      </div>
    );
  }

  const isDraft = invoice.invoice.status === "draft";

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
          {isDraft ? "Editar borrador" : "Detalle de factura"}
        </h1>
      </div>

      <div className="max-w-2xl">
        {isDraft ? (
          <InvoiceForm
            key={invoice.invoice.id}
            mode="edit"
            invoice={invoice}
            services={services}
            customers={customers}
            action={updateInvoiceDraft}
            issueAction={issueInvoice}
            deleteAction={deleteInvoice}
          />
        ) : (
          <InvoiceDetail invoice={invoice} />
        )}
      </div>
    </div>
  );
}
