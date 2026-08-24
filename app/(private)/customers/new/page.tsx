import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CustomerForm } from "@/modules/clients/components/CustomerForm";
import { createCustomer } from "@/modules/clients/actions";
import { getActiveDocumentTypes } from "@/modules/admin/document-types/queries";

export default async function NewCustomerPage() {
  const supabase = await createClient();
  const documentTypes = await getActiveDocumentTypes(supabase);

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
          Crear cliente
        </h1>
      </div>

      <div className="max-w-xl">
        <CustomerForm
          mode="create"
          documentTypes={documentTypes}
          action={createCustomer}
        />
      </div>
    </div>
  );
}
