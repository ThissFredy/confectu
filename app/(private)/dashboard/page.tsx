import { createClient } from "@/lib/supabase/server";
import { RetryButton } from "@/modules/admin/components/RetryButton";
import { DashboardView } from "@/modules/dashboard/components/DashboardView";
import { getDashboardStats } from "@/modules/dashboard/queries";
import type { DashboardFilters } from "@/modules/dashboard/types";

interface DashboardPageProps {
  searchParams: Promise<{
    from?: string;
    to?: string;
  }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createClient();
  const params = await searchParams;

  const filters: DashboardFilters = {
    from: params.from,
    to: params.to,
  };

  let hasError = false;
  let stats;

  try {
    stats = await getDashboardStats(supabase, filters);
  } catch {
    hasError = true;
  }

  if (hasError || !stats) {
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

  return <DashboardView stats={stats} filters={filters} />;
}
