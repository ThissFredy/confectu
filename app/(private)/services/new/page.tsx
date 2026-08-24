import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ServiceForm } from "@/modules/services/components/ServiceForm";
import { createService } from "@/modules/services/actions";

export default async function NewServicePage() {
  await createClient();

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
          Crear servicio
        </h1>
      </div>

      <div className="max-w-xl">
        <ServiceForm mode="create" action={createService} />
      </div>
    </div>
  );
}
