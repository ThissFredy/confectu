import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { updateDocumentType } from "@/modules/admin/document-types/actions";
import { DocumentTypeForm } from "@/modules/admin/document-types/components/DocumentTypeForm";
import { DocumentTypeStatusToggle } from "@/modules/admin/document-types/components/DocumentTypeStatusToggle";
import { NotFoundNotice } from "@/modules/admin/document-types/components/NotFoundNotice";
import { getDocumentTypeById } from "@/modules/admin/document-types/queries";

interface EditDocumentTypePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditDocumentTypePage({
  params,
}: EditDocumentTypePageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const documentType = await getDocumentTypeById(supabase, id);

  if (!documentType) {
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
          href="/admin/document-types"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Volver a la lista
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Editar tipo de documento
        </h1>
      </div>

      <div className="max-w-xl">
        <DocumentTypeForm
          mode="edit"
          documentType={documentType}
          action={updateDocumentType}
        />

        <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
            Estado
          </h2>
          <DocumentTypeStatusToggle documentType={documentType} />
        </div>
      </div>
    </div>
  );
}
