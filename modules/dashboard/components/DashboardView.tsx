import type { DashboardStats, DashboardFilters } from "../types";
import { DashboardFilters as DashboardFiltersComponent } from "./DashboardFilters";
import { EmptyDashboard } from "./EmptyDashboard";
import { RecentInvoicesList } from "./RecentInvoicesList";
import { StatCard } from "./StatCard";

interface DashboardViewProps {
  stats: DashboardStats;
  filters: DashboardFilters;
}

export function DashboardView({ stats, filters }: DashboardViewProps) {
  const hasFilter = Boolean(stats.filtered);
  const hasAnyData =
    stats.recentInvoices.length > 0 || stats.draftCount > 0;

  if (!hasAnyData) {
    return (
      <div className="flex flex-col gap-6 px-4 py-6 md:px-8">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Dashboard
        </h1>
        <EmptyDashboard />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6 md:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Dashboard
        </h1>
      </div>

      <DashboardFiltersComponent initialFrom={filters.from} initialTo={filters.to} />

      <section aria-label="Indicadores operativos">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Facturas emitidas"
            format="number"
            thisMonthValue={stats.thisMonth?.issuedCount}
            generalValue={stats.allTime?.issuedCount}
            singleValue={stats.filtered?.issuedCount}
          />

          <StatCard
            label="Total facturado"
            format="currency"
            thisMonthValue={stats.thisMonth?.totalInvoicedCop}
            generalValue={stats.allTime?.totalInvoicedCop}
            singleValue={stats.filtered?.totalInvoicedCop}
          />

          <StatCard
            label="Facturas invalidadas"
            format="number"
            thisMonthValue={stats.thisMonth?.voidedCount}
            generalValue={stats.allTime?.voidedCount}
            singleValue={stats.filtered?.voidedCount}
          />

          <StatCard
            label="Prendas confeccionadas"
            format="number"
            thisMonthValue={stats.thisMonth?.garmentsTotal}
            generalValue={stats.allTime?.garmentsTotal}
            singleValue={stats.filtered?.garmentsTotal}
          />

          <StatCard
            label="Servicios confeccionados"
            format="number"
            thisMonthValue={stats.thisMonth?.servicesTotal}
            generalValue={stats.allTime?.servicesTotal}
            singleValue={stats.filtered?.servicesTotal}
          />

          <StatCard
            label="Facturas en borrador"
            format="number"
            singleValue={stats.draftCount}
          />

          <StatCard
            label="Clientes activos"
            format="number"
            singleValue={stats.activeCustomerCount}
          />
        </div>
      </section>

      {hasFilter && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Mostrando datos
          {filters.from && (
            <>
              {" "}desde el{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {filters.from}
              </span>
            </>
          )}
          {filters.to && (
            <>
              {" "}hasta el{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {filters.to}
              </span>
            </>
          )}
          .
        </p>
      )}

      <RecentInvoicesList invoices={stats.recentInvoices} />
    </div>
  );
}
