import { createClient } from "@/lib/supabase/server";
import { RetryButton } from "@/modules/admin/components/RetryButton";
import { WorkshopList } from "@/modules/admin/workshops/components/WorkshopList";
import { listWorkshopsWithCustomers } from "@/modules/admin/workshops/queries";
import type { WorkshopWithCustomers } from "@/modules/admin/workshops/types";

export default async function WorkshopsPage() {
  const supabase = await createClient();

  let workshops: WorkshopWithCustomers[] = [];
  let hasError = false;

  try {
    workshops = await listWorkshopsWithCustomers(supabase);
  } catch {
    hasError = true;
  }

  if (hasError) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          No se pudieron cargar los talleres.
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
        Talleres
      </h1>
      <WorkshopList workshops={workshops} />
    </div>
  );
}
