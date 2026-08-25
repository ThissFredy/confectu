import { createClient } from "@/lib/supabase/server";
import { CustomerList } from "@/modules/clients/components/CustomerList";
import { RetryButton } from "@/modules/admin/components/RetryButton";
import { listCustomers } from "@/modules/clients/queries";
import type { Customer } from "@/modules/clients/types";

export default async function CustomersPage() {
  const supabase = await createClient();

  let customers: Customer[] = [];
  let hasError = false;

  try {
    customers = await listCustomers(supabase, { includeInactive: false });
  } catch {
    hasError = true;
  }

  if (hasError) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          No se pudieron cargar los clientes.
        </h2>
        <div className="mt-6">
          <RetryButton />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-8">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Clientes
      </h1>
      <CustomerList customers={customers} />
    </div>
  );
}
