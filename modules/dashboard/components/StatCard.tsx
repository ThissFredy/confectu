interface StatCardProps {
  label: string;
  format: "number" | "currency";
  thisMonthValue?: number;
  generalValue?: number;
  singleValue?: number;
}

function formatValue(value: number, format: "number" | "currency"): string {
  if (format === "currency") {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  }

  return new Intl.NumberFormat("es-CO").format(value);
}

export function StatCard({
  label,
  format,
  thisMonthValue,
  generalValue,
  singleValue,
}: StatCardProps) {
  const hasTwoValues =
    typeof thisMonthValue === "number" && typeof generalValue === "number";

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </p>

      {hasTwoValues ? (
        <div className="mt-3 grid grid-cols-2 gap-4 divide-x divide-zinc-200 dark:divide-zinc-800">
          <div className="pr-4">
            <p className="text-xs text-zinc-500 dark:text-zinc-500">Este mes</p>
            <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {formatValue(thisMonthValue, format)}
            </p>
          </div>
          <div className="pl-4">
            <p className="text-xs text-zinc-500 dark:text-zinc-500">General</p>
            <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {formatValue(generalValue, format)}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {formatValue(typeof singleValue === "number" ? singleValue : 0, format)}
        </p>
      )}
    </div>
  );
}
