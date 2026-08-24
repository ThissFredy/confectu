import type { Service } from "../types";

interface ServiceReadOnlyListProps {
  services: Service[];
  emptyMessage?: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function ServiceReadOnlyList({
  services,
  emptyMessage = "Sin servicios.",
}: ServiceReadOnlyListProps) {
  if (services.length === 0) {
    return (
      <p className="py-8 text-center text-zinc-600 dark:text-zinc-400">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {services.map((service) => (
        <li
          key={service.id}
          className="flex flex-col gap-1 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {service.name}
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {service.category ?? "Sin categoría"}
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {formatCurrency(service.defaultPriceCop)}
            </p>
          </div>
          <span
            className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${
              service.isActive
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {service.isActive ? "Activo" : "Inactivo"}
          </span>
        </li>
      ))}
    </ul>
  );
}
