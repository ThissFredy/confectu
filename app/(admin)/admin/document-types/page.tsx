import { createClient } from "@/lib/supabase/server";
import { RetryButton } from "@/modules/admin/components/RetryButton";
import { DocumentTypeList } from "@/modules/admin/document-types/components/DocumentTypeList";
import { listDocumentTypes } from "@/modules/admin/document-types/queries";
import type { DocumentType } from "@/modules/admin/document-types/types";

export default async function DocumentTypesPage() {
  const supabase = await createClient();

  let documentTypes: DocumentType[] = [];
  let hasError = false;

  try {
    documentTypes = await listDocumentTypes(supabase);
  } catch {
    hasError = true;
  }

  if (hasError) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          No se pudieron cargar los tipos de documento.
        </h2>
        <div className="mt-6">
          <RetryButton />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-8">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Tipos de documento
      </h1>
      <DocumentTypeList documentTypes={documentTypes} />
    </div>
  );
}
