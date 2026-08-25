import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ServiceForm } from "@/modules/services/components/ServiceForm";
import { ServiceStatusToggle } from "@/modules/services/components/ServiceStatusToggle";
import { NotFoundNotice } from "@/modules/services/components/NotFoundNotice";
import { updateService, toggleServiceStatus } from "@/modules/services/actions";
import { getServiceById } from "@/modules/services/queries";

interface EditServicePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditServicePage({ params }: EditServicePageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const service = await getServiceById(supabase, id);

  if (!service) {
    return (
      <div className="px-4 py-6 md:px-8">
        <NotFoundNotice />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="mb-6">
        <Link
          href="/services"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Volver a la lista
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Editar servicio
        </h1>
      </div>

      <div className="max-w-xl">
        <ServiceForm
          key={service.id}
          mode="edit"
          service={service}
          action={updateService}
        />

        <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
            Estado
          </h2>
          <ServiceStatusToggle service={service} action={toggleServiceStatus} />
        </div>
      </div>
    </div>
  );
}
