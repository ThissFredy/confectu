import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminCustomerForm } from "@/modules/admin/clients/components/AdminCustomerForm";
import { AdminCustomerStatusToggle } from "@/modules/admin/clients/components/AdminCustomerStatusToggle";
import { NotFoundNotice } from "@/modules/admin/clients/components/NotFoundNotice";
import {
  updateCustomerAsAdmin,
  toggleCustomerStatusAsAdmin,
} from "@/modules/admin/clients/actions";
import { getCustomerByIdAsAdmin } from "@/modules/admin/clients/queries";
import { getActiveDocumentTypes } from "@/modules/admin/document-types/queries";

interface EditAdminCustomerPageProps {
  params: Promise<{ id: string; customerId: string }>;
}

export default async function EditAdminCustomerPage({
  params,
}: EditAdminCustomerPageProps) {
  const { id, customerId } = await params;
  const supabase = await createClient();

  const [customer, documentTypes] = await Promise.all([
    getCustomerByIdAsAdmin(supabase, customerId),
    getActiveDocumentTypes(supabase),
  ]);

  if (!customer || customer.workshopId !== id) {
    return (
      <div className="px-4 py-6 md:px-8">
        <NotFoundNotice workshopId={id} />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="mb-6">
        <Link
          href={`/admin/workshops/${id}`}
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Volver al taller
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Editar cliente
        </h1>
      </div>

      <div className="max-w-xl">
        <AdminCustomerForm
          key={customer.id}
          customer={customer}
          documentTypes={documentTypes}
          action={updateCustomerAsAdmin}
        />

        <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
            Estado
          </h2>
          <AdminCustomerStatusToggle
            customer={customer}
            action={toggleCustomerStatusAsAdmin}
          />
        </div>
      </div>
    </div>
  );
}
