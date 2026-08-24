import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CustomerForm } from "@/modules/clients/components/CustomerForm";
import { CustomerStatusToggle } from "@/modules/clients/components/CustomerStatusToggle";
import { NotFoundNotice } from "@/modules/clients/components/NotFoundNotice";
import { updateCustomer, toggleCustomerStatus } from "@/modules/clients/actions";
import { getCustomerById } from "@/modules/clients/queries";
import { getActiveDocumentTypes } from "@/modules/admin/document-types/queries";

interface EditCustomerPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [customer, documentTypes] = await Promise.all([
    getCustomerById(supabase, id),
    getActiveDocumentTypes(supabase),
  ]);

  if (!customer) {
    return (
      <div className="px-4 py-6 md:px-8">
        <NotFoundNotice />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="mb-6">
        <Link
          href="/customers"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Volver a la lista
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Editar cliente
        </h1>
      </div>

      <div className="max-w-xl">
        <CustomerForm
          key={customer.id}
          mode="edit"
          customer={customer}
          documentTypes={documentTypes}
          action={updateCustomer}
        />

        <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
            Estado
          </h2>
          <CustomerStatusToggle customer={customer} action={toggleCustomerStatus} />
        </div>
      </div>
    </div>
  );
}
