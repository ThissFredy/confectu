import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NotFoundNotice } from "@/modules/admin/workshops/components/NotFoundNotice";
import { WorkshopSettingsForm } from "@/modules/workshops/components/WorkshopSettingsForm";
import { CustomerList } from "@/modules/clients/components/CustomerList";
import { AdminServiceReadOnlyList } from "@/modules/admin/workshops/components/AdminServiceReadOnlyList";
import { updateWorkshopSettings } from "@/modules/admin/workshops/actions";
import { toggleCustomerStatusAsAdmin } from "@/modules/admin/clients/actions";
import { getWorkshopById } from "@/modules/admin/workshops/queries";
import { getWorkshopLogoUrl } from "@/modules/workshops/queries";
import { listCustomersByWorkshop } from "@/modules/admin/clients/queries";
import { listServicesByWorkshop } from "@/modules/services/queries";

interface EditWorkshopPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditWorkshopPage({
  params,
}: EditWorkshopPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const workshop = await getWorkshopById(supabase, id);

  if (!workshop) {
    return (
      <div className="px-4 py-6 md:px-8">
        <NotFoundNotice />
      </div>
    );
  }

  const [logoUrl, customers, services] = await Promise.all([
    workshop.settings?.logoPath
      ? getWorkshopLogoUrl(supabase, workshop.settings.logoPath)
      : Promise.resolve(null),
    listCustomersByWorkshop(supabase, id),
    listServicesByWorkshop(supabase, id),
  ]);

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="mb-6">
        <Link
          href="/admin/workshops"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Volver a la lista
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {workshop.settings?.businessName ?? "Taller"}
        </h1>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex-1">
          <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
            Configuración
          </h2>
          <div className="max-w-xl">
            <WorkshopSettingsForm
              workshop={workshop}
              logoUrl={logoUrl}
              currentLogoPath={workshop.settings?.logoPath ?? null}
              action={updateWorkshopSettings}
              showNextInvoiceNumber={true}
            />
          </div>
        </div>

        <div className="flex-1">
          <div className="mt-8 lg:mt-0">
            <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
              Servicios del taller
            </h2>
            <AdminServiceReadOnlyList services={services} />
          </div>
        </div>
      </div>

      <div className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Clientes del taller
        </h2>
        <CustomerList
          customers={customers}
          statusToggleAction={toggleCustomerStatusAsAdmin}
        />
      </div>
    </div>
  );
}
