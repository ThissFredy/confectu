import type { AdminCounts } from "@/modules/admin/document-types/types";

interface AdminDashboardProps {
  counts: AdminCounts;
}

export function AdminDashboard({ counts }: AdminDashboardProps) {
  const cards = [
    { label: "Clientes", value: counts.customers },
    { label: "Talleres", value: counts.workshops },
    { label: "Facturas", value: counts.invoices },
    { label: "Servicios", value: counts.services },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {card.label}
          </p>
          <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
