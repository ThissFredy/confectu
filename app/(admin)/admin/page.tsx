import { createClient } from "@/lib/supabase/server";
import { AdminDashboard } from "@/modules/admin/components/AdminDashboard";
import { RetryButton } from "@/modules/admin/components/RetryButton";
import { getAdminCounts } from "@/modules/admin/document-types/queries";
import type { AdminCounts } from "@/modules/admin/document-types/types";

export default async function AdminPage() {
  const supabase = await createClient();

  let counts: AdminCounts | null = null;
  let hasError = false;

  try {
    counts = await getAdminCounts(supabase);
  } catch {
    hasError = true;
  }

  if (hasError || !counts) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          No se pudieron cargar las estadísticas.
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
        Administración
      </h1>
      <AdminDashboard counts={counts} />
    </div>
  );
}
