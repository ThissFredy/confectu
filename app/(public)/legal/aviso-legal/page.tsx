import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aviso legal | Confectu",
  description:
    "Aviso legal de Confectu: titular del sitio, objeto, propiedad intelectual y responsabilidad.",
};

export default function LegalNoticePage() {
  return (
    <article>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Aviso legal
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Última actualización: 27 de agosto de 2026
      </p>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          1. Titular del sitio
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Confectu es una aplicación web de facturación para talleres de
          confección. El titular y responsable del sitio es{" "}
          <strong>Fredy Zarate</strong>{" "}
          <a
            href="github.com/ThissFredy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 underline hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            @thissfredy
          </a>{" "}
          con domicilio en Colombia.
        </p>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Email de contacto: <strong>ing.fredyzarate@outlook.com</strong>.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          2. Objeto
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          El presente aviso legal regula el acceso y uso de la aplicación
          Confectu, que permite a los talleres de confección gestionar sus
          clientes, servicios y facturas.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          3. Propiedad intelectual
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          El contenido, el diseño, el código y los elementos distintivos de
          Confectu son titularidad de su responsable y se encuentran protegidos
          por las normas de propiedad intelectual e industrial. Queda prohibida
          su reproducción, distribución o modificación sin autorización previa,
          salvo en los términos permitidos por la ley o la licencia aplicable.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          4. Responsabilidad
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Confectu se ofrece &ldquo;tal cual&rdquo; y no garantiza la
          disponibilidad ininterrumpida del servicio. El responsable no se hace
          responsable de los daños derivados del uso indebido de la aplicación,
          de la información cargada por los usuarios ni de la validez legal de
          los documentos generados.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          5. Enlaces a terceros
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Confectu puede enlazar a servicios de terceros (como Google para la
          autenticación). El responsable no asume responsabilidad por el
          contenido ni por las políticas de esos sitios.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          6. Contacto
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Para cualquier consulta relacionada con este aviso legal, escríbenos a{" "}
          <strong>[Email de contacto]</strong>.
        </p>
      </section>
    </article>
  );
}
