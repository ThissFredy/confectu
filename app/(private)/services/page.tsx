import { createClient } from "@/lib/supabase/server";
import { ServiceList } from "@/modules/services/components/ServiceList";
import { RetryButton } from "@/modules/admin/components/RetryButton";
import { listServices } from "@/modules/services/queries";
import type { Service } from "@/modules/services/types";

export default async function ServicesPage() {
  const supabase = await createClient();

  let services: Service[] = [];
  let hasError = false;

  try {
    services = await listServices(supabase, { includeInactive: false });
  } catch {
    hasError = true;
  }

  if (hasError) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          No se pudieron cargar los servicios.
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
        Servicios
      </h1>
      <ServiceList services={services} />
    </div>
  );
}
