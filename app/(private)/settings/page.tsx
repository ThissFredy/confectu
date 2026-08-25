import { createClient } from "@/lib/supabase/server";
import { NotFoundNotice } from "@/modules/workshops/components/NotFoundNotice";
import { WorkshopSettingsForm } from "@/modules/workshops/components/WorkshopSettingsForm";
import { updateMyWorkshopSettings } from "@/modules/workshops/actions";
import {
  getCurrentWorkshopWithSettings,
  getWorkshopLogoUrl,
} from "@/modules/workshops/queries";

export default async function SettingsPage() {
  const supabase = await createClient();
  const workshop = await getCurrentWorkshopWithSettings(supabase);

  if (!workshop) {
    return (
      <div className="px-4 py-6 md:px-8">
        <NotFoundNotice />
      </div>
    );
  }

  const logoUrl = workshop.settings?.logoPath
    ? await getWorkshopLogoUrl(supabase, workshop.settings.logoPath)
    : null;

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Configuración del taller
        </h1>
        <WorkshopSettingsForm
          workshop={workshop}
          logoUrl={logoUrl}
          currentLogoPath={workshop.settings?.logoPath ?? null}
          action={updateMyWorkshopSettings}
        />
      </div>
    </div>
  );
}
