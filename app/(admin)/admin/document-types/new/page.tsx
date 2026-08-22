import Link from "next/link";
import { createDocumentType } from "@/modules/admin/document-types/actions";
import { DocumentTypeForm } from "@/modules/admin/document-types/components/DocumentTypeForm";

export default function NewDocumentTypePage() {
  return (
    <div className="px-4 py-6 md:px-8">
      <div className="mb-6">
        <Link
          href="/admin/document-types"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Volver a la lista
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Crear tipo de documento
        </h1>
      </div>

      <div className="max-w-xl">
        <DocumentTypeForm mode="create" action={createDocumentType} />
      </div>
    </div>
  );
}
