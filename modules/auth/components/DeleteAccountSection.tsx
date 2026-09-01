import { DeleteAccountButton } from "./DeleteAccountButton";

interface DeleteAccountSectionProps {
  hasWorkshop?: boolean;
}

export function DeleteAccountSection({
  hasWorkshop = false,
}: DeleteAccountSectionProps) {
  return (
    <section aria-labelledby="delete-account-title">
      <h2
        id="delete-account-title"
        className="text-lg font-medium text-zinc-900 dark:text-zinc-100"
      >
        Eliminar cuenta
      </h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {hasWorkshop
          ? "Se desactivarán tu cuenta y tu taller. Se conserva todo tu historial de clientes, servicios y facturas, y puedes reactivar tu cuenta contactándonos."
          : "Se desactivará tu cuenta y cerraremos tu sesión. Puedes reactivar tu cuenta contactándonos."}
      </p>
      <div className="mt-4">
        <DeleteAccountButton />
      </div>
    </section>
  );
}
