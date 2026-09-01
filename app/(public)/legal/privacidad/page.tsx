import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad | Confectu",
  description:
    "Política de privacidad de Confectu: datos que recopilamos, finalidades, proveedores y derechos del titular.",
};

export default function PrivacyPolicyPage() {
  return (
    <article>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Política de privacidad
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Última actualización: 27 de agosto de 2026
      </p>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          1. Responsable del tratamiento
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          <strong>[Nombre o razón social]</strong>, identificado(a) con{" "}
          <strong>[Cédula o NIT]</strong> y con domicilio en Colombia, es el
          responsable del tratamiento de los datos personales recopilados a
          través de Confectu.
        </p>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Email de contacto: <strong>[Email de contacto]</strong>.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          2. Datos que recopilamos
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          <li>
            <strong>Datos de cuenta:</strong> nombre, dirección de correo
            electrónico y foto de perfil, obtenidos al iniciar sesión con
            Google.
          </li>
          <li>
            <strong>Datos del taller:</strong> nombre del negocio, NIT, teléfono,
            email, dirección, logotipo e instrucciones de pago.
          </li>
          <li>
            <strong>Datos de tus clientes (terceros):</strong> nombre, tipo y
            número de documento, teléfono, email, dirección y notas que cargas
            en la plataforma.
          </li>
          <li>
            <strong>Datos de facturación:</strong> número de factura, valores,
            líneas de detalle, ajustes e instrucciones de pago.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          3. Finalidades del tratamiento
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          <li>Permitir el acceso y uso de la plataforma.</li>
          <li>Gestionar clientes, servicios y facturas de tu taller.</li>
          <li>Generar y descargar facturas en PDF.</li>
          <li>Prestar soporte y responder tus solicitudes.</li>
          <li>Cumplir obligaciones legales aplicables.</li>
        </ul>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          4. Tratamiento de datos de terceros (tus clientes)
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Como usuario de Confectu, eres responsable de obtener la autorización
          de tus clientes para el tratamiento de sus datos personales conforme a
          la Ley 1581 de 2012 y demás normas aplicables. Confectu actúa como
          encargado del tratamiento respecto de dichos datos y los trata
          únicamente para prestarte el servicio.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          5. Base para el tratamiento
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Tratamos tus datos personales para ejecutar el servicio que solicitas
          al crear tu cuenta y usar la plataforma, y con tu autorización
          otorgada al registrarte. Puedes revocar tu autorización en cualquier
          momento, lo que puede impedir el uso continuado del servicio.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          6. Proveedores y transferencias
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Para prestar el servicio utilizamos proveedores que actúan como
          encargados del tratamiento:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          <li>
            <strong>Supabase:</strong> alojamiento, base de datos y
            autenticación.
          </li>
          <li>
            <strong>Google:</strong> autenticación de inicio de sesión.
          </li>
        </ul>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          No vendemos ni compartimos tus datos personales con fines comerciales.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          7. Cookies
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Utilizamos únicamente cookies técnicas de sesión necesarias para el
          funcionamiento de la plataforma. Consulta nuestra{" "}
          <a
            href="/legal/cookies"
            className="font-medium text-zinc-900 underline dark:text-zinc-100"
          >
            Política de cookies
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          8. Retención y eliminación de datos
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Conservamos tus datos mientras tu cuenta esté activa. Puedes eliminar
          tu cuenta desde la sección de ajustes; la eliminación es reversible
          (soft delete) y conserva tu historial para que puedas reactivarla.
          Para solicitar la eliminación definitiva de tus datos, escríbenos a{" "}
          <strong>[Email de contacto]</strong>.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          9. Derechos del titular
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Como titular de los datos, tienes derecho a conocer, actualizar,
          rectificar y suprimir tus datos personales, así como a revocar la
          autorización otorgada y a presentar quejas ante la Superintendencia de
          Industria y Comercio (SIC). Para ejercer tus derechos, escríbenos a{" "}
          <strong>[Email de contacto]</strong>.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          10. Seguridad de la información
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Aplicamos medidas técnicas y organizativas para proteger tus datos,
          como el aislamiento entre talleres (multi-tenant), políticas de acceso
          a nivel de fila y conexiones cifradas.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          11. Menores de edad
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          La plataforma no está dirigida a menores de edad y no recopilamos
          intencionalmente sus datos personales.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          12. Cambios en esta política
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Podemos actualizar esta política para reflejar cambios en el servicio
          o en la normativa. Publicaremos la versión actualizada en esta misma
          página.
        </p>
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          13. Contacto
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Para cualquier consulta sobre esta política o sobre el tratamiento de
          tus datos, escríbenos a <strong>[Email de contacto]</strong>.
        </p>
      </section>
    </article>
  );
}
