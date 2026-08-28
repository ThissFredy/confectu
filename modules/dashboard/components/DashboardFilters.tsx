"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface DashboardFiltersProps {
  initialFrom?: string;
  initialTo?: string;
}

export function DashboardFilters({
  initialFrom = "",
  initialTo = "",
}: DashboardFiltersProps) {
  const router = useRouter();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  const hasFilter = Boolean(initialFrom) && Boolean(initialTo);

  function handleFilter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!from && !to) {
      return;
    }

    if (from && to && new Date(from) > new Date(to)) {
      return;
    }

    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    router.push(`/dashboard?${params.toString()}`);
  }

  function handleClear() {
    setFrom("");
    setTo("");
    router.push("/dashboard");
  }

  return (
    <form
      onSubmit={handleFilter}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Filtrar por fechas
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="dashboard-filter-from"
            className="text-sm text-zinc-600 dark:text-zinc-400"
          >
            Desde
          </label>
          <input
            id="dashboard-filter-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none transition-colors focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="dashboard-filter-to"
            className="text-sm text-zinc-600 dark:text-zinc-400"
          >
            Hasta
          </label>
          <input
            id="dashboard-filter-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none transition-colors focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={!from && !to}
          className="inline-flex h-12 min-h-[44px] flex-1 items-center justify-center rounded-lg bg-zinc-900 px-4 text-base font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Filtrar
        </button>

        {hasFilter && (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex h-12 min-h-[44px] flex-1 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-base font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Limpiar filtro
          </button>
        )}
      </div>
    </form>
  );
}
