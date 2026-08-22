"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DocumentTypeStatusToggle } from "./DocumentTypeStatusToggle";
import type { DocumentType } from "../types";

interface DocumentTypeListProps {
  documentTypes: DocumentType[];
}

export function DocumentTypeList({ documentTypes }: DocumentTypeListProps) {
  const [filter, setFilter] = useState("");

  const normalizedFilter = filter.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalizedFilter) {
      return documentTypes;
    }

    return documentTypes.filter(
      (documentType) =>
        documentType.code.toLowerCase().includes(normalizedFilter) ||
        documentType.name.toLowerCase().includes(normalizedFilter),
    );
  }, [documentTypes, normalizedFilter]);

  if (documentTypes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-zinc-200 px-4 py-12 text-center dark:border-zinc-800">
        <p className="text-lg text-zinc-900 dark:text-zinc-100">
          No hay tipos de documento.
        </p>
        <Link
          href="/admin/document-types/new"
          className="inline-flex h-12 min-h-[44px] items-center justify-center rounded-lg bg-zinc-900 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Crear tipo
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filtrar por código o nombre"
          aria-label="Filtrar tipos de documento"
          className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10 sm:max-w-sm"
        />
        <Link
          href="/admin/document-types/new"
          className="inline-flex h-12 min-h-[44px] items-center justify-center rounded-lg bg-zinc-900 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Crear tipo
        </Link>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-zinc-600 dark:text-zinc-400">
          No se encontraron tipos con ese filtro.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((documentType) => (
            <li
              key={documentType.id}
              className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-1">
                <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {documentType.code} - {documentType.name}
                </p>
                <span
                  className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    documentType.isActive
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {documentType.isActive ? "Activo" : "Inactivo"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/document-types/${documentType.id}`}
                  className="inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  Editar
                </Link>
                <DocumentTypeStatusToggle documentType={documentType} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
