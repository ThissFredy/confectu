import { DeleteAccountSection } from "@/modules/auth/components/DeleteAccountSection";

export default function AdminSettingsPage() {
  return (
    <div className="px-4 py-6 md:px-8">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Configuración
        </h1>
        <DeleteAccountSection />
      </div>
    </div>
  );
}
