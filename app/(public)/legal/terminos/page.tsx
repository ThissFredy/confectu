import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos y condiciones | Confectu",
  description:
    "Términos y condiciones de uso de Confectu: reglas de uso del servicio, responsabilidad y limitación de responsabilidad.",
};

export default function TermsPage() {
  return (
    <article>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Términos y condiciones
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Última actualización: 27 de agosto de 2026
      </p>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          1. Aceptación
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Al acceder y utilizar Confectu aceptas estos términos y condiciones.
          Si no estás de acuerdo, no utilices la plataforma.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          2. Descripción del servicio
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Confectu permite a los talleres de confección gestionar sus clientes,
          servicios o prendas, y crear, consultar y descargar facturas. El
          servicio se ofrece actualmente de forma gratuita.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          3. Cuenta y registro
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          El acceso se realiza exclusivamente mediante Google. Eres responsable
          de mantener la confidencialidad de tu cuenta y de toda la actividad
          que ocurra bajo la misma.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          4. Uso permitido y prohibido
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Aceptas utilizar la plataforma de forma lícita y conforme a su
          finalidad. Queda prohibido, entre otros:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          <li>Acceder a datos de otros talleres o usuarios.</li>
          <li>
            Cargar datos personales de terceros sin su debida autorización.
          </li>
          <li>
            Usar la plataforma para actividades ilícitas, fraudulentas o que
            infrinjan derechos de terceros.
          </li>
          <li>
            Intentar dañar, interferir o acceder de forma no autorizada al
            servicio o su infraestructura.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          5. Responsabilidad sobre los datos
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Eres el único responsable de la exactitud, licitud y contenido de los
          datos que cargues en la plataforma, incluidos los datos personales de
          tus clientes, respecto de los cuales debes contar con la autorización
          legalmente requerida.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          6. Facturación y validez legal
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Confectu es una herramienta de gestión y generación de documentos. Eres
          responsable de verificar que las facturas y documentos generados
          cumplen con los requisitos legales y fiscales aplicables en tu
          jurisdicción, así como de su correcta presentación ante las
          autoridades competentes.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          7. Disponibilidad del servicio
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          El servicio se presta &ldquo;tal cual&rdquo; y &ldquo;según
          disponibilidad&rdquo;. No garantizamos que esté disponible de forma
          ininterrumpida o libre de errores, y nos reservamos el derecho de
          modificar, suspender o interrumpir el servicio en cualquier momento.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          8. Propiedad intelectual
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          La plataforma y su contenido son titularidad de su responsable y están
          protegidos por las normas aplicables. El uso del servicio no te otorga
          derechos sobre el software más allá de los necesarios para su
          utilización.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          9. Limitación de responsabilidad
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          En la máxima medida permitida por la ley, no seremos responsables por
          daños indirectos, incidentales o consecuentes derivados del uso o de
          la imposibilidad de uso del servicio, ni por la pérdida de datos
          originada por causas ajenas a nuestro control.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          10. Suspensión y terminación
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Podemos suspender o cancelar tu acceso a la plataforma en caso de uso
          indebido o incumplimiento de estos términos. Puedes dejar de usar el
          servicio en cualquier momento.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          11. Modificaciones
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Podemos actualizar estos términos. Las modificaciones se publicarán en
          esta página y se considerarán aceptadas si continúas usando el
          servicio.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          12. Ley aplicable y jurisdicción
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Estos términos se rigen por las leyes de la República de Colombia.
          Cualquier controversia se someterá a los tribunales competentes de
          Colombia.
        </p>
      </section>
    </article>
  );
}
